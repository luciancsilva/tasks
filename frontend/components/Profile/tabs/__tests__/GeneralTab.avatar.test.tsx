import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeneralTab from '../GeneralTab';
import type { ProfileFormData } from '../../types';

// t(key, fallback?) -> fallback when given, else the key itself, so both the
// English fallbacks and the bare keys render as stable selectors.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

const renderTab = (overrides: {
    isActive?: boolean;
    formData?: ProfileFormData;
    avatarPreview?: string | null;
    onAvatarSelect?: (file: File) => void;
    onAvatarRemove?: () => void;
}) =>
    render(
        <GeneralTab
            isActive={overrides.isActive ?? true}
            formData={overrides.formData ?? {}}
            avatarPreview={overrides.avatarPreview ?? null}
            onAvatarSelect={overrides.onAvatarSelect ?? jest.fn()}
            onAvatarRemove={overrides.onAvatarRemove ?? jest.fn()}
            onChange={jest.fn()}
            onAppearanceChange={jest.fn()}
            onLanguageChange={jest.fn()}
            onTimezoneChange={jest.fn()}
            onFirstDayChange={jest.fn()}
            timezonesByRegion={{}}
            getRegionDisplayName={(region: string) => region}
        />
    );

describe('GeneralTab avatar', () => {
    it('renders nothing when the tab is not active', () => {
        const { container } = renderTab({ isActive: false });
        expect(container.firstChild).toBeNull();
    });

    describe('avatarPreview', () => {
        it('renders a data: preview as-is', () => {
            const preview = 'data:image/png;base64,iVBORw0KGgo=';
            renderTab({ avatarPreview: preview });
            expect(screen.getByRole('img')).toHaveAttribute('src', preview);
        });

        it('renders a blob: preview as-is', () => {
            const preview = 'blob:http://localhost/9f8e-7d6c';
            renderTab({ avatarPreview: preview });
            expect(screen.getByRole('img')).toHaveAttribute('src', preview);
        });

        it('drops a preview with any other scheme and falls back to the placeholder', () => {
            renderTab({ avatarPreview: 'http://evil.test/tracker.png' });
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });

        it('takes precedence over a stored avatar_image', () => {
            const preview = 'data:image/png;base64,iVBORw0KGgo=';
            renderTab({
                avatarPreview: preview,
                formData: { avatar_image: '/uploads/avatars/stored.png' },
            });
            expect(screen.getByRole('img')).toHaveAttribute('src', preview);
        });
    });

    describe('formData.avatar_image', () => {
        // The backend stores `/uploads/avatars/<filename>`
        // (backend/modules/users/service.js:231); the tab must route it
        // through the authenticated /api/uploads proxy.
        it('renders a stored avatar through getApiPath', () => {
            renderTab({ formData: { avatar_image: '/uploads/avatars/a.png' } });
            expect(screen.getByRole('img')).toHaveAttribute(
                'src',
                '/api/uploads/avatars/a.png'
            );
        });

        it.each([
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'vbscript:msgbox(1)',
            'file:///etc/passwd',
        ])('drops the dangerous scheme %s', (url) => {
            renderTab({ formData: { avatar_image: url } });
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });

        it('renders the placeholder when there is no avatar at all', () => {
            renderTab({});
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });
    });

    describe('remove button', () => {
        it('is hidden when there is no avatar', () => {
            renderTab({});
            expect(
                screen.queryByText('Remove Avatar')
            ).not.toBeInTheDocument();
        });

        it('shows for a stored avatar and calls onAvatarRemove when clicked', () => {
            const onAvatarRemove = jest.fn();
            renderTab({
                formData: { avatar_image: '/uploads/avatars/a.png' },
                onAvatarRemove,
            });
            fireEvent.click(screen.getByText('Remove Avatar'));
            expect(onAvatarRemove).toHaveBeenCalledTimes(1);
        });

        it('shows for a pending preview even with no stored avatar', () => {
            renderTab({ avatarPreview: 'blob:http://localhost/9f8e' });
            expect(screen.getByText('Remove Avatar')).toBeInTheDocument();
        });
    });

    describe('file input', () => {
        it('passes the picked file to onAvatarSelect', () => {
            const onAvatarSelect = jest.fn();
            const { container } = renderTab({ onAvatarSelect });
            const input = container.querySelector(
                '#avatar-upload'
            ) as HTMLInputElement;
            const file = new File(['x'], 'me.png', { type: 'image/png' });

            fireEvent.change(input, { target: { files: [file] } });

            expect(onAvatarSelect).toHaveBeenCalledTimes(1);
            expect(onAvatarSelect).toHaveBeenCalledWith(file);
        });

        it('ignores a change event with no file (picker cancelled)', () => {
            const onAvatarSelect = jest.fn();
            const { container } = renderTab({ onAvatarSelect });
            const input = container.querySelector(
                '#avatar-upload'
            ) as HTMLInputElement;

            fireEvent.change(input, { target: { files: [] } });

            expect(onAvatarSelect).not.toHaveBeenCalled();
        });
    });
});
