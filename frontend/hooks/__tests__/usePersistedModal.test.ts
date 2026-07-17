import { renderHook, act } from '@testing-library/react';
import { usePersistedModal } from '../usePersistedModal';

describe('usePersistedModal timer cleanup', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        sessionStorage.clear();
        jest.spyOn(global, 'clearTimeout');
    });

    afterEach(() => {
        (clearTimeout as jest.Mock).mockRestore();
        jest.useRealTimers();
    });

    it('clears the previous pending timer when openModal is called again', () => {
        const { result } = renderHook(() => usePersistedModal(1));

        act(() => {
            result.current.openModal();
        });
        act(() => {
            result.current.openModal();
        });

        // Second openModal must have cleared the first pending timeout.
        expect(clearTimeout).toHaveBeenCalled();
    });

    it('clears the pending timer on immediate unmount', () => {
        const { result, unmount } = renderHook(() => usePersistedModal(1));

        act(() => {
            result.current.openModal();
        });

        (clearTimeout as jest.Mock).mockClear();
        unmount();

        // Unmount cleanup must clear the still-pending timeout so the
        // sessionStorage-cleanup callback never fires on an unmounted hook.
        expect(clearTimeout).toHaveBeenCalled();
    });
});
