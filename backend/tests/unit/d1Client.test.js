const { D1Client, D1Error } = require('../../db/d1Client');

const okPayload = (results = [], meta = {}) => ({
    success: true,
    errors: [],
    result: [{ success: true, results, meta }],
});

const jsonResponse = (payload, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
});

const clientWith = (fetchImpl, overrides = {}) =>
    new D1Client({
        accountId: 'acc',
        databaseId: 'db',
        apiToken: 'token',
        fetchImpl,
        ...overrides,
    });

describe('D1Client', () => {
    it('requires credentials', () => {
        expect(() => new D1Client({})).toThrow(D1Error);
    });

    it('POSTs sql + params with the auth token and parses the first result', async () => {
        const fetchMock = jest.fn(async () =>
            jsonResponse(okPayload([{ id: 1 }], { last_row_id: 7, changes: 1 }))
        );
        const client = clientWith(fetchMock);

        const { results, meta } = await client.query(
            'SELECT * FROM tasks WHERE id = ?',
            [1]
        );

        expect(results).toEqual([{ id: 1 }]);
        expect(meta.last_row_id).toBe(7);

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(
            'https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db/query'
        );
        expect(options.headers.Authorization).toBe('Bearer token');
        expect(JSON.parse(options.body)).toEqual({
            sql: 'SELECT * FROM tasks WHERE id = ?',
            params: [1],
        });
    });

    it('throws D1Error with the API message on success:false (no retry)', async () => {
        const fetchMock = jest.fn(async () =>
            jsonResponse(
                {
                    success: false,
                    errors: [
                        {
                            code: 7500,
                            message:
                                'UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT',
                        },
                    ],
                },
                400
            )
        );
        const client = clientWith(fetchMock);

        await expect(client.query('INSERT ...')).rejects.toMatchObject({
            name: 'D1Error',
            code: 'SQLITE_CONSTRAINT',
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 and succeeds afterwards', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(jsonResponse({}, 429))
            .mockResolvedValueOnce(jsonResponse(okPayload([{ ok: 1 }])));
        const client = clientWith(fetchMock);

        const { results } = await client.query('SELECT 1');

        expect(results).toEqual([{ ok: 1 }]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries on network errors and gives up after the retry budget', async () => {
        const fetchMock = jest.fn(async () => {
            throw new Error('socket hang up');
        });
        const client = clientWith(fetchMock);

        await expect(client.query('SELECT 1')).rejects.toMatchObject({
            name: 'D1Error',
        });
        expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });

    it('waits for a rate-limit slot instead of exceeding the window', async () => {
        const fetchMock = jest.fn(async () => jsonResponse(okPayload()));
        const client = clientWith(fetchMock, {
            maxRequestsPerWindow: 2,
            windowMs: 200,
        });

        const start = Date.now();
        await client.query('SELECT 1');
        await client.query('SELECT 2');
        await client.query('SELECT 3'); // must wait for the window to slide

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(Date.now() - start).toBeGreaterThanOrEqual(150);
    });
});
