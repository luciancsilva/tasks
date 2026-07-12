import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RecurrenceDisplay from '../RecurrenceDisplay';

// t(key, fallback, opts?) -> fallback, so English fallbacks render literally.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

// Resolve first-day-of-week so the weekday-ordering effect settles.
jest.mock('../../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
}));

describe('RecurrenceDisplay', () => {
    it('renders nothing for recurrenceType="none"', () => {
        const { container } = render(<RecurrenceDisplay recurrenceType="none" />);
        expect(container.firstChild).toBeNull();
    });

    it('renders "Daily" for daily recurrence type', () => {
        render(<RecurrenceDisplay recurrenceType="daily" />);
        expect(screen.getByText('Daily')).toBeInTheDocument();
    });

    it('renders "Every 3 days" for daily with interval 3', () => {
        render(<RecurrenceDisplay recurrenceType="daily" recurrenceInterval={3} />);
        expect(screen.getByText('Every 3 days')).toBeInTheDocument();
    });

    it('renders "Weekly" for weekly recurrence type', () => {
        render(<RecurrenceDisplay recurrenceType="weekly" />);
        expect(screen.getByText('Weekly')).toBeInTheDocument();
    });

    it('renders "Every 2 weeks" for weekly with interval 2', () => {
        render(<RecurrenceDisplay recurrenceType="weekly" recurrenceInterval={2} />);
        expect(screen.getByText('Every 2 weeks')).toBeInTheDocument();
    });

    it('renders "Monthly" for monthly recurrence type', () => {
        render(<RecurrenceDisplay recurrenceType="monthly" />);
        expect(screen.getByText('Monthly')).toBeInTheDocument();
    });

    it('renders "Every 2 months" for monthly with interval 2', () => {
        render(<RecurrenceDisplay recurrenceType="monthly" recurrenceInterval={2} />);
        expect(screen.getByText('Every 2 months')).toBeInTheDocument();
    });

    it('renders "Monthly on weekday" for monthly_weekday recurrence type', () => {
        render(<RecurrenceDisplay recurrenceType="monthly_weekday" />);
        expect(screen.getByText('Monthly on weekday')).toBeInTheDocument();
    });

    it('renders "Monthly on last day" for monthly_last_day recurrence type', () => {
        render(<RecurrenceDisplay recurrenceType="monthly_last_day" />);
        expect(screen.getByText('Monthly on last day')).toBeInTheDocument();
    });

    it('renders "After completion" when completionBased is true', () => {
        render(<RecurrenceDisplay recurrenceType="daily" completionBased={true} />);
        expect(screen.getByText('After completion')).toBeInTheDocument();
    });

    it('renders "On day 15" for monthly recurrence with recurrenceMonthDay 15', () => {
        render(<RecurrenceDisplay recurrenceType="monthly" recurrenceMonthDay={15} />);
        expect(screen.getByText(/On day 15/)).toBeInTheDocument();
    });

    it('renders "Until <date>" when recurrenceEndDate is set', () => {
        render(<RecurrenceDisplay recurrenceType="daily" recurrenceEndDate="2026-12-31" />);
        expect(screen.getByText(/Until/)).toBeInTheDocument();
    });

    it('renders "Repeat on" section with weekday chips for weekly recurrence', async () => {
        render(<RecurrenceDisplay recurrenceType="weekly" recurrenceWeekdays={[1, 3, 5]} />);
        
        await waitFor(() => {
            expect(screen.getByText('Repeat on:')).toBeInTheDocument();
        });

        // 1: Mon, 3: Wed, 5: Fri
        expect(screen.getByText('Mon')).toBeInTheDocument();
        expect(screen.getByText('Wed')).toBeInTheDocument();
        expect(screen.getByText('Fri')).toBeInTheDocument();
    });
});
