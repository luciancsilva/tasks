import i18n from '../i18n';

export const fetcher = async (url: string) => {
    const response = await fetch(url, {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(
            errorData.error ||
                i18n.t('errors.fetchError', 'An error occurred while fetching the data.')
        );
        (error as any).info = errorData;
        (error as any).status = response.status;
        throw error;
    }

    return response.json();
};
