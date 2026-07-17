import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BrandingTab from '../BrandingTab';
import { fetchWithCsrf } from '../../../../utils/csrfService';
import type { Branding } from '../../../../contexts/BrandingContext';

// t(key, fallback?) -> fallback when given, else the key itself.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

// The real one fetches /api/csrf-token on first use.
jest.mock('../../../../utils/csrfService', () => ({
    fetchWithCsrf: jest.fn(),
}));

// The real useToast throws outside a ToastProvider, so this mock is required.
jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: mockShowSuccessToast,
        showErrorToast: mockShowErrorToast,
    }),
}));

jest.mock('../../../../contexts/BrandingContext', () => ({
    useBranding: () => ({
        branding: mockBranding,
        refreshBranding: mockRefreshBranding,
    }),
}));

const mockShowSuccessToast = jest.fn();
const mockShowErrorToast = jest.fn();
const mockRefreshBranding = jest.fn().mockResolvedValue(undefined);
let mockBranding: Branding;

// jest.mock is hoisted above the import, so this binding is already the mock.
const mockFetch = fetchWithCsrf as jest.Mock;

const EMPTY_BRANDING: Branding = {
    app_name: null,
    logo_light: null,
    logo_dark: null,
    favicon: null,
};

const ok = (value = true) => Promise.resolve({ ok: value } as Response);

beforeEach(() => {
    jest.clearAllMocks();
    mockBranding = { ...EMPTY_BRANDING };
    mockFetch.mockImplementation(() => ok());
});

describe('BrandingTab', () => {
    it('renders nothing when the tab is not active', () => {
        const { container } = render(<BrandingTab isActive={false} />);
        expect(container.firstChild).toBeNull();
    });

    describe('app name', () => {
        it('initialises the input from the current branding', () => {
            mockBranding = { ...EMPTY_BRANDING, app_name: 'Acme Tasks' };
            render(<BrandingTab isActive={true} />);
            expect(screen.getByLabelText('Application name')).toHaveValue(
                'Acme Tasks'
            );
        });

        it('falls back to an empty input when no name is set', () => {
            render(<BrandingTab isActive={true} />);
            expect(screen.getByLabelText('Application name')).toHaveValue('');
        });

        it('re-syncs the input when the branding changes underneath', () => {
            const { rerender } = render(<BrandingTab isActive={true} />);
            expect(screen.getByLabelText('Application name')).toHaveValue('');

            mockBranding = { ...EMPTY_BRANDING, app_name: 'Renamed' };
            rerender(<BrandingTab isActive={true} />);

            expect(screen.getByLabelText('Application name')).toHaveValue(
                'Renamed'
            );
        });

        it('PUTs the trimmed name, refreshes and reports success', async () => {
            render(<BrandingTab isActive={true} />);
            fireEvent.change(screen.getByLabelText('Application name'), {
                target: { value: '  Acme Tasks  ' },
            });
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe('/api/branding');
            expect(options.method).toBe('PUT');
            expect(JSON.parse(options.body)).toEqual({ app_name: 'Acme Tasks' });

            await waitFor(() =>
                expect(mockRefreshBranding).toHaveBeenCalledTimes(1)
            );
            expect(mockShowSuccessToast).toHaveBeenCalledWith(
                'Branding updated successfully'
            );
            expect(mockShowErrorToast).not.toHaveBeenCalled();
        });

        it('reports an error and skips the refresh when the server rejects', async () => {
            mockFetch.mockImplementation(() => ok(false));
            render(<BrandingTab isActive={true} />);
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() =>
                expect(mockShowErrorToast).toHaveBeenCalledWith(
                    'Failed to update branding'
                )
            );
            expect(mockRefreshBranding).not.toHaveBeenCalled();
            expect(mockShowSuccessToast).not.toHaveBeenCalled();
        });

        it('disables the save button while the request is in flight', async () => {
            let release: (value: Response) => void = () => {};
            mockFetch.mockImplementation(
                () =>
                    new Promise<Response>((resolve) => {
                        release = resolve;
                    })
            );
            render(<BrandingTab isActive={true} />);
            const save = screen.getByText('Save');

            fireEvent.click(save);
            await waitFor(() => expect(save).toBeDisabled());

            release({ ok: true } as Response);
            await waitFor(() => expect(save).not.toBeDisabled());
        });
    });

    describe('asset rows', () => {
        it('shows the Default placeholder for every unset asset', () => {
            render(<BrandingTab isActive={true} />);
            expect(screen.getAllByText('Default')).toHaveLength(3);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });

        // The context holds the public URL the backend stored
        // (`/api/branding/asset/<filename>`, see backend/modules/branding/
        // service.js:26), not the R2 key. getApiPath must leave it alone
        // rather than prefix a second `api/`.
        it('renders a set asset without double-prefixing the api path', () => {
            mockBranding = {
                ...EMPTY_BRANDING,
                logo_light: '/api/branding/asset/logo_light-123-abc.png',
            };
            render(<BrandingTab isActive={true} />);
            expect(screen.getByAltText('Logo (light theme)')).toHaveAttribute(
                'src',
                '/api/branding/asset/logo_light-123-abc.png'
            );
            expect(screen.getAllByText('Default')).toHaveLength(2);
        });

        it('offers Remove only for assets that are set', () => {
            render(<BrandingTab isActive={true} />);
            expect(screen.queryByText('Remove')).not.toBeInTheDocument();

            mockBranding = {
                ...EMPTY_BRANDING,
                favicon: '/api/branding/asset/favicon-1-2.ico',
            };
            render(<BrandingTab isActive={true} />);
            expect(screen.getAllByText('Remove')).toHaveLength(1);
        });
    });

    describe('upload', () => {
        it('POSTs the picked file as FormData to the asset endpoint', async () => {
            const { container } = render(<BrandingTab isActive={true} />);
            const input = container.querySelector(
                'input[type="file"]'
            ) as HTMLInputElement;
            const file = new File(['x'], 'logo.png', { type: 'image/png' });

            fireEvent.change(input, { target: { files: [file] } });

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe('/api/branding/asset/logo_light');
            expect(options.method).toBe('POST');
            expect(options.body).toBeInstanceOf(FormData);

            await waitFor(() =>
                expect(mockRefreshBranding).toHaveBeenCalledTimes(1)
            );
            expect(mockShowSuccessToast).toHaveBeenCalled();
        });

        it('reports an error when the upload is rejected', async () => {
            mockFetch.mockImplementation(() => ok(false));
            const { container } = render(<BrandingTab isActive={true} />);
            const input = container.querySelector(
                'input[type="file"]'
            ) as HTMLInputElement;

            fireEvent.change(input, {
                target: {
                    files: [new File(['x'], 'logo.png', { type: 'image/png' })],
                },
            });

            await waitFor(() =>
                expect(mockShowErrorToast).toHaveBeenCalledWith(
                    'Failed to upload image'
                )
            );
            expect(mockRefreshBranding).not.toHaveBeenCalled();
        });

        it('ignores a change event with no file (picker cancelled)', () => {
            const { container } = render(<BrandingTab isActive={true} />);
            const input = container.querySelector(
                'input[type="file"]'
            ) as HTMLInputElement;

            fireEvent.change(input, { target: { files: [] } });

            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('DELETEs the asset, refreshes and reports success', async () => {
            mockBranding = {
                ...EMPTY_BRANDING,
                favicon: '/api/branding/asset/favicon-1-2.ico',
            };
            render(<BrandingTab isActive={true} />);

            fireEvent.click(screen.getByText('Remove'));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe('/api/branding/asset/favicon');
            expect(options.method).toBe('DELETE');

            await waitFor(() =>
                expect(mockRefreshBranding).toHaveBeenCalledTimes(1)
            );
            expect(mockShowSuccessToast).toHaveBeenCalled();
        });

        it('reports an error when the removal is rejected', async () => {
            mockBranding = {
                ...EMPTY_BRANDING,
                favicon: '/api/branding/asset/favicon-1-2.ico',
            };
            mockFetch.mockImplementation(() => ok(false));
            render(<BrandingTab isActive={true} />);

            fireEvent.click(screen.getByText('Remove'));

            await waitFor(() =>
                expect(mockShowErrorToast).toHaveBeenCalledWith(
                    'Failed to update branding'
                )
            );
            expect(mockRefreshBranding).not.toHaveBeenCalled();
        });
    });
});
