'use strict';

/**
 * Check if the provided language is Portuguese (pt, pt-BR, pt-PT, etc.)
 * @param {string} language
 * @returns {boolean}
 */
function isPtLanguage(language) {
    if (!language) return false;
    if (typeof language === 'string') {
        const lang = language.toLowerCase();
        return (
            lang === 'pt' || lang.startsWith('pt-') || lang.startsWith('pt_')
        );
    }
    return false;
}

/**
 * Get localized welcome message
 * @param {string} language
 * @param {boolean} includeStartCommand
 * @returns {string}
 */
function getWelcomeMessage(language = 'en', includeStartCommand = true) {
    const isPt = isPtLanguage(language);
    if (isPt) {
        if (includeStartCommand) {
            return `🎉 Bem-vindo ao tududi!\n\nSeu bot pessoal de gerenciamento de tarefas está conectado e pronto para ajudar!\n\n📝 Basta me enviar qualquer mensagem e eu adicionarei como um item na sua caixa de entrada do tududi.\n\n✨ Comandos:\n• /help - Mostrar informações de ajuda\n• /start - Mostrar mensagem de boas-vindas\n• Digite qualquer texto - Adicionar como item na caixa de entrada\n\nVamos nos organizar! 🚀`;
        }
        return `🎉 Bem-vindo ao tududi!\n\nSeu bot pessoal de gerenciamento de tarefas está conectado e pronto para ajudar!\n\n📝 Basta me enviar qualquer mensagem e eu adicionarei como um item na sua caixa de entrada do tududi.\n\n✨ Comandos:\n• /help - Mostrar informações de ajuda\n• Digite qualquer texto - Adicionar como item na caixa de entrada\n\nVamos nos organizar! 🚀`;
    }

    if (includeStartCommand) {
        return `🎉 Welcome to tududi!\n\nYour personal task management bot is now connected and ready to help!\n\n📝 Simply send me any message and I'll add it to your tududi inbox as an item.\n\n✨ Commands:\n• /help - Show help information\n• /start - Show welcome message\n• Just type any text - Add it as an inbox item\n\nLet's get organized! 🚀`;
    }
    return `🎉 Welcome to tududi!\n\nYour personal task management bot is now connected and ready to help!\n\n📝 Simply send me any message and I'll add it to your tududi inbox as an item.\n\n✨ Commands:\n• /help - Show help information\n• Just type any text - Add it as an inbox item\n\nLet's get organized! 🚀`;
}

/**
 * Get localized help message
 * @param {string} language
 * @returns {string}
 */
function getHelpMessage(language = 'en') {
    const isPt = isPtLanguage(language);
    if (isPt) {
        return `📋 Ajuda do Bot tududi\n\nEnvie-me qualquer mensagem de texto e eu adicionarei como um item na sua caixa de entrada do tududi.\n\nComandos:\n/start - Mensagem de boas-vindas\n/help - Mostrar esta mensagem de ajuda\n\nBasta digitar seu item e eu cuido do resto!`;
    }
    return `📋 tududi Bot Help\n\nSend me any text message and I'll add it to your tududi inbox as an inbox item.\n\nCommands:\n/start - Welcome message\n/help - Show this help message\n\nJust type your item and I'll take care of the rest!`;
}

/**
 * Get localized unknown command message
 * @param {string} command
 * @param {string} language
 * @returns {string}
 */
function getUnknownCommandMessage(command, language = 'en') {
    const isPt = isPtLanguage(language);
    if (isPt) {
        return `❓ Comando desconhecido: ${command}\n\nUse /help para ver os comandos disponíveis ou basta enviar uma mensagem normal para adicioná-la à sua caixa de entrada.`;
    }
    return `❓ Unknown command: ${command}\n\nUse /help to see available commands or just send a regular message to add it to your inbox.`;
}

/**
 * Get localized added to inbox message
 * @param {string} text
 * @param {string} language
 * @returns {string}
 */
function getAddedToInboxMessage(text, language = 'en') {
    const isPt = isPtLanguage(language);
    if (isPt) {
        return `✅ Adicionado à caixa de entrada do tududi: "${text}"`;
    }
    return `✅ Added to tududi inbox: "${text}"`;
}

/**
 * Get localized failed to add message
 * @param {string} errorMessage
 * @param {string} language
 * @returns {string}
 */
function getFailedToAddMessage(errorMessage, language = 'en') {
    const isPt = isPtLanguage(language);
    if (isPt) {
        return `❌ Falha ao adicionar à caixa de entrada: ${errorMessage}`;
    }
    return `❌ Failed to add to inbox: ${errorMessage}`;
}

module.exports = {
    isPtLanguage,
    getWelcomeMessage,
    getHelpMessage,
    getUnknownCommandMessage,
    getAddedToInboxMessage,
    getFailedToAddMessage,
};
