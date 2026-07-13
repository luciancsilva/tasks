const {
    isPtLanguage,
    getWelcomeMessage,
    getHelpMessage,
    getUnknownCommandMessage,
    getAddedToInboxMessage,
    getFailedToAddMessage,
} = require('../../../../modules/telegram/telegramMessages');

describe('Telegram Messages Localization', () => {
    describe('isPtLanguage', () => {
        test('should return true for pt variants', () => {
            expect(isPtLanguage('pt')).toBe(true);
            expect(isPtLanguage('PT')).toBe(true);
            expect(isPtLanguage('pt-BR')).toBe(true);
            expect(isPtLanguage('pt-PT')).toBe(true);
            expect(isPtLanguage('pt_BR')).toBe(true);
        });

        test('should return false for non-pt or empty/null languages', () => {
            expect(isPtLanguage('en')).toBe(false);
            expect(isPtLanguage('es')).toBe(false);
            expect(isPtLanguage(null)).toBe(false);
            expect(isPtLanguage(undefined)).toBe(false);
            expect(isPtLanguage(123)).toBe(false);
        });
    });

    describe('getWelcomeMessage', () => {
        test('should return Portuguese welcome message when language is pt', () => {
            const msg = getWelcomeMessage('pt', true);
            expect(msg).toContain('Bem-vindo ao tududi!');
            expect(msg).toContain('/start');
            expect(msg).toContain('Basta me enviar qualquer mensagem');
        });

        test('should omit /start when includeStartCommand is false for pt', () => {
            const msg = getWelcomeMessage('pt', false);
            expect(msg).toContain('Bem-vindo ao tududi!');
            expect(msg).not.toContain('/start');
        });

        test('should return English welcome message when language is en or other', () => {
            const msg = getWelcomeMessage('en', true);
            expect(msg).toContain('Welcome to tududi!');
            expect(msg).toContain('/start');

            const msgWithoutStart = getWelcomeMessage('en', false);
            expect(msgWithoutStart).not.toContain('/start');
        });
    });

    describe('getHelpMessage', () => {
        test('should return Portuguese help message when language is pt', () => {
            const msg = getHelpMessage('pt-BR');
            expect(msg).toContain('Ajuda do Bot tududi');
            expect(msg).toContain('Envie-me qualquer mensagem');
        });

        test('should return English help message when language is en', () => {
            const msg = getHelpMessage('en');
            expect(msg).toContain('tududi Bot Help');
            expect(msg).toContain('Send me any text message');
        });
    });

    describe('getUnknownCommandMessage', () => {
        test('should return Portuguese unknown command message when language is pt', () => {
            const msg = getUnknownCommandMessage('/foo', 'pt');
            expect(msg).toContain('Comando desconhecido: /foo');
            expect(msg).toContain('Use /help para ver os comandos disponíveis');
        });

        test('should return English unknown command message when language is en', () => {
            const msg = getUnknownCommandMessage('/foo', 'en');
            expect(msg).toContain('Unknown command: /foo');
            expect(msg).toContain('Use /help to see available commands');
        });
    });

    describe('getAddedToInboxMessage', () => {
        test('should return Portuguese confirmation when language is pt', () => {
            const msg = getAddedToInboxMessage('Buy milk', 'pt');
            expect(msg).toEqual(
                '✅ Adicionado à caixa de entrada do tududi: "Buy milk"'
            );
        });

        test('should return English confirmation when language is en', () => {
            const msg = getAddedToInboxMessage('Buy milk', 'en');
            expect(msg).toEqual('✅ Added to tududi inbox: "Buy milk"');
        });
    });

    describe('getFailedToAddMessage', () => {
        test('should return Portuguese error when language is pt', () => {
            const msg = getFailedToAddMessage('Invalid format', 'pt');
            expect(msg).toEqual(
                '❌ Falha ao adicionar à caixa de entrada: Invalid format'
            );
        });

        test('should return English error when language is en', () => {
            const msg = getFailedToAddMessage('Invalid format', 'en');
            expect(msg).toEqual('❌ Failed to add to inbox: Invalid format');
        });
    });
});
