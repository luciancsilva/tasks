import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuickCaptureInput, {
    cleanQuickCaptureText,
    tokenizeQuickCaptureText,
} from '../QuickCaptureInput';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, fallback?: string) => fallback || key }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({
        tagsStore: {
            setTags: jest.fn(),
            refreshTags: jest.fn(),
            getTags: () => [],
        },
    }),
}));

jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: () => 'fake-csrf-token',
}));

jest.mock('../../../utils/tagsService', () => ({
    createTag: jest.fn(),
}));

jest.mock('../../../utils/projectsService', () => ({
    createProject: jest.fn(),
}));

jest.mock('../../../utils/peopleService', () => ({
    createPerson: jest.fn(),
}));

jest.mock('../../../utils/urlService', () => ({
    isUrl: jest.fn().mockReturnValue(false),
    extractUrlTitle: jest.fn(),
}));

describe('QuickCaptureInput - cleanQuickCaptureText unit tests', () => {
    it('removes accented person mentions like @Márcia and @João', () => {
        expect(cleanQuickCaptureText('Comprar pão @Márcia')).toBe('Comprar pão');
        expect(cleanQuickCaptureText('Reunião com @João hoje')).toBe('Reunião com hoje');
        expect(cleanQuickCaptureText('@Inês verificar documento')).toBe('verificar documento');
    });

    it('removes accented and complex hashtags like #tag-acentuada', () => {
        expect(cleanQuickCaptureText('Verificar fatura #área-financeira')).toBe('Verificar fatura');
        expect(cleanQuickCaptureText('#tópico-urgente preparar relatório')).toBe('preparar relatório');
    });

    it('removes project references and quoted mentions like @"João da Silva"', () => {
        expect(cleanQuickCaptureText('Falar com @"João da Silva" sobre +Projeto')).toBe('Falar com sobre');
        expect(cleanQuickCaptureText('Encontro @"Maria Clara" +"Super Projeto" hoje')).toBe('Encontro hoje');
    });

    it('does not remove regular emails or terms like c++ and c#', () => {
        expect(
            cleanQuickCaptureText('Enviar e-mail para joao@empresa.com.br e revisar c++ ou c#')
        ).toBe('Enviar e-mail para joao@empresa.com.br e revisar c++ ou c#');
    });

    it('tokenizes correctly handling quotes and whitespace', () => {
        const tokens = tokenizeQuickCaptureText('Tarefa com @"Maria Clara"\t+Projeto\n#tópico');
        expect(tokens).toEqual(['Tarefa', 'com', '@"Maria Clara"', '+Projeto', '#tópico']);
    });
});

describe('QuickCaptureInput - component submit fallback behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                suggested_type: 'task',
                cleaned_content: 'Comprar leite',
                parsed_tags: [],
                parsed_projects: [],
                parsed_people: [],
            }),
        });
    });

    it('uses cleanQuickCaptureText fallback on fast submit when analysis text does not match current input', async () => {

        const onTaskCreate = jest.fn().mockResolvedValue(undefined);

        render(<QuickCaptureInput onTaskCreate={onTaskCreate} />);

        const textarea = screen.getByTestId('quick-capture-input');
        fireEvent.change(textarea, { target: { value: 'Comprar leite' } });

        // Wait for debounced analysis of initial text to resolve
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        // User quickly adds @Márcia #tópico-urgente and submits before debounce can re-analyze
        fireEvent.change(textarea, { target: { value: 'Comprar leite @Márcia #tópico-urgente' } });
        const submitButton = screen.getByRole('button', { name: /Add/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(onTaskCreate).toHaveBeenCalledTimes(1);
        });

        expect(onTaskCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Comprar leite',
                status: 'not_started',
            })
        );
    });
});
