import React, { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    startOfWeek,
    endOfWeek,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    getFirstDayOfWeek,
    getLocaleFirstDayOfWeek,
} from '../../utils/profileService';

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'task' | 'event';
    color?: string;
}

interface CalendarMonthViewProps {
    currentDate: Date;
    events: CalendarEvent[];
    onDateClick?: (date: Date) => void;
    onEventClick?: (event: CalendarEvent) => void;
    onEventDrop?: (eventId: string, newDate: Date) => void;
    onCreateOnDay?: (day: Date) => void;
}

const DraggableEvent: React.FC<{
    event: CalendarEvent;
    onEventClick?: (e: CalendarEvent) => void;
}> = ({ event, onEventClick }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({ id: event.id });
    // Defer events (task-defer-*) are display-only — not draggable.
    const isDefer = event.id.startsWith('task-defer-');
    const style: React.CSSProperties = {
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        backgroundColor: event.color || '#3b82f6',
        opacity: isDragging ? 0.4 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(isDefer ? {} : listeners)}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onEventClick?.(event);
            }}
            className={`text-xs px-1.5 py-1 rounded text-white truncate font-medium hover:opacity-90 transition-opacity ${
                !isDefer ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            }`}
            title={event.title}
        >
            {event.title}
        </div>
    );
};

const DroppableCell: React.FC<{
    day: Date;
    isCurrentMonth: boolean;
    isTodayDate: boolean;
    events: CalendarEvent[];
    onDateClick?: (d: Date) => void;
    onEventClick?: (e: CalendarEvent) => void;
    onCreateOnDay?: (d: Date) => void;
}> = ({ day, isCurrentMonth, isTodayDate, events, onDateClick, onEventClick, onCreateOnDay }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `cell-${format(day, 'yyyy-MM-dd')}`,
    });
    return (
        <div
            ref={setNodeRef}
            onClick={() => onDateClick?.(day)}
            onDoubleClick={() => onCreateOnDay?.(day)}
            className={`p-2 border-b border-gray-100 dark:border-gray-600 cursor-pointer flex flex-col min-h-[90px] transition-colors ${
                isOver
                    ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-inset ring-blue-400'
                    : !isCurrentMonth
                      ? 'bg-gray-50 dark:bg-gray-800'
                      : isTodayDate
                        ? 'bg-blue-50 dark:bg-blue-900/15'
                        : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600/40'
            }`}
        >
            <div className="mb-1.5">
                {isTodayDate ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-semibold rounded-full">
                        {format(day, 'd')}
                    </span>
                ) : (
                    <span
                        className={`text-sm font-medium ${
                            !isCurrentMonth
                                ? 'text-gray-300 dark:text-gray-600'
                                : 'text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        {format(day, 'd')}
                    </span>
                )}
            </div>
            <div className="space-y-0.5 overflow-hidden flex-1">
                {events.slice(0, 3).map((event) => (
                    <DraggableEvent
                        key={event.id}
                        event={event}
                        onEventClick={onEventClick}
                    />
                ))}
                {events.length > 3 && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 px-1 font-medium">
                        +{events.length - 3}
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
    currentDate,
    events,
    onDateClick,
    onEventClick,
    onEventDrop,
    onCreateOnDay,
}) => {
    const { t } = useTranslation();
    const [firstDayOfWeek, setFirstDayOfWeek] = useState(1);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                setFirstDayOfWeek(await getFirstDayOfWeek());
            } catch {
                setFirstDayOfWeek(getLocaleFirstDayOfWeek(navigator.language));
            }
        };
        loadFirstDayOfWeek();
    }, []);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, {
        weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });
    const calendarEnd = endOfWeek(monthEnd, {
        weekStartsOn: firstDayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const getAllWeekDays = () => [
        t('weekdays.sunday', 'Sun'),
        t('weekdays.monday', 'Mon'),
        t('weekdays.tuesday', 'Tue'),
        t('weekdays.wednesday', 'Wed'),
        t('weekdays.thursday', 'Thu'),
        t('weekdays.friday', 'Fri'),
        t('weekdays.saturday', 'Sat'),
    ];

    const getWeekDays = () => {
        const allDays = getAllWeekDays();
        return [...allDays.slice(firstDayOfWeek), ...allDays.slice(0, firstDayOfWeek)];
    };

    const handleDragEnd = (e: DragEndEvent) => {
        const eventId = e.active.id as string;
        const droppable = e.over?.id as string | undefined;
        if (droppable?.startsWith('cell-')) {
            const dayStr = droppable.replace('cell-', '');
            const day = new Date(dayStr + 'T00:00:00');
            onEventDrop?.(eventId, day);
        }
    };

    return (
        <div className="h-full bg-white dark:bg-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col border border-gray-200 dark:border-gray-600">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                {getWeekDays().map((day) => (
                    <div
                        key={day}
                        className="py-3 text-center text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr divide-x divide-gray-100 dark:divide-gray-600">
                    {days.map((day) => {
                        const dayEvents = events.filter(
                            (event) =>
                                format(event.start, 'yyyy-MM-dd') ===
                                format(day, 'yyyy-MM-dd')
                        );
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isTodayDate = isToday(day);

                        return (
                            <DroppableCell
                                key={day.toString()}
                                day={day}
                                isCurrentMonth={isCurrentMonth}
                                isTodayDate={isTodayDate}
                                events={dayEvents}
                                onDateClick={onDateClick}
                                onEventClick={onEventClick}
                                onCreateOnDay={onCreateOnDay}
                            />
                        );
                    })}
                </div>
            </DndContext>
        </div>
    );
};

export default CalendarMonthView;
