import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InboxItemDetail from '../InboxItemDetail';

// Plan 66: GTD triage buttons in the inbox composer footer.

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback || _key,
    }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('react-router-dom', () => ({
    Link: ({ children }: any) => children,
}));

// Only real store slices — no peopleStore. If someone reintroduces a
// peopleStore reference (the plan-26 crash bug), this mock won't have it and
// the mount throws, so this test guards the regression.
jest.mock('../../../store/useStore', () => ({
    useStore: () => ({
        tagsStore: { tags: [] },
        areasStore: { areas: [] },
    }),
}));

jest.mock('../../../utils/peopleService', () => ({ createPerson: jest.fn() }));
jest.mock('../../../utils/urlService', () => ({
    isUrl: () => false,
    extractUrlTitle: jest.fn(),
}));

// Render the footer actions directly so the triage buttons mount without the
// real composer's internals.
jest.mock('../QuickCaptureInput', () => {
    const Mock = React.forwardRef((props: any) => (
        <div data-testid="mock-composer">
            {props.renderFooterActions
                ? props.renderFooterActions({ text: props.initialValue })
                : null}
        </div>
    ));
    Mock.displayName = 'MockQuickCaptureInput';
    return { __esModule: true, default: Mock };
});

jest.mock('../InboxCard', () => ({
    __esModule: true,
    default: ({ children, className }: any) => (
        <div className={className}>{children}</div>
    ),
}));

jest.mock('../../Shared/ConfirmDialog', () => ({
    __esModule: true,
    default: ({ onConfirm }: any) => (
        <button data-testid="confirm-delete" onClick={onConfirm}>
            confirm
        </button>
    ),
}));

const baseItem = {
    uid: 'inbox-1',
    content: 'Buy milk',
    status: 'added',
    created_at: new Date().toISOString(),
};

function renderDetail() {
    const props = {
        item: baseItem as any,
        onDelete: jest.fn(),
        onUpdate: jest.fn(),
        openTaskModal: jest.fn(),
        openProjectModal: jest.fn(),
        openNoteModal: jest.fn(),
        projects: [] as any[],
        people: [] as any[],
    };
    render(<InboxItemDetail {...props} />);
    // Enter edit mode so the composer footer (with triage buttons) mounts.
    fireEvent.click(screen.getByText('Buy milk'));
    return props;
}

describe('InboxItemDetail — GTD triage (66)', () => {
    it('renders all six triage buttons', () => {
        renderDetail();
        expect(screen.getByTestId('triage-action')).toBeInTheDocument();
        expect(screen.getByTestId('triage-2min')).toBeInTheDocument();
        expect(screen.getByTestId('triage-project')).toBeInTheDocument();
        expect(screen.getByTestId('triage-reference')).toBeInTheDocument();
        expect(screen.getByTestId('triage-someday')).toBeInTheDocument();
        expect(screen.getByTestId('triage-trash')).toBeInTheDocument();
    });

    it('2-min action creates a task with status done', async () => {
        const props = renderDetail();
        fireEvent.click(screen.getByTestId('triage-2min'));
        await waitFor(() => expect(props.openTaskModal).toHaveBeenCalled());
        expect(props.openTaskModal).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'done' }),
            'inbox-1'
        );
    });

    it('Someday creates a task with is_someday true', async () => {
        const props = renderDetail();
        fireEvent.click(screen.getByTestId('triage-someday'));
        await waitFor(() => expect(props.openTaskModal).toHaveBeenCalled());
        expect(props.openTaskModal).toHaveBeenCalledWith(
            expect.objectContaining({ is_someday: true }),
            'inbox-1'
        );
    });

    it('Action creates a not-started task', async () => {
        const props = renderDetail();
        fireEvent.click(screen.getByTestId('triage-action'));
        await waitFor(() => expect(props.openTaskModal).toHaveBeenCalled());
        expect(props.openTaskModal).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'not_started' }),
            'inbox-1'
        );
    });

    it('Trash deletes the item after confirmation', () => {
        const props = renderDetail();
        fireEvent.click(screen.getByTestId('triage-trash'));
        fireEvent.click(screen.getByTestId('confirm-delete'));
        expect(props.onDelete).toHaveBeenCalledWith('inbox-1');
    });
});
