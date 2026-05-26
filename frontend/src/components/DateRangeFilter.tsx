import { getCalendarYearRange } from '../utils/dateRange';

type DateRangeFilterProps = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  className?: string;
};

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  className = ''
}: DateRangeFilterProps) {
  const applyCalendarYear = () => {
    const { from, to } = getCalendarYearRange();
    onDateFromChange(from);
    onDateToChange(to);
  };

  const currentYear = new Date().getFullYear();
  const isCalendarYear =
    dateFrom === `${currentYear}-01-01` && dateTo === `${currentYear}-12-31`;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span className="text-sm font-medium text-slate-700">Période :</span>
      <button
        type="button"
        onClick={applyCalendarYear}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          isCalendarYear
            ? 'bg-indigo-600 text-white shadow'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        Année civile en cours
      </button>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Du</span>
        <input
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(e) => {
            const value = e.target.value;
            onDateFromChange(value);
            if (value > dateTo) onDateToChange(value);
          }}
          className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Au</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom}
          onChange={(e) => {
            const value = e.target.value;
            onDateToChange(value);
            if (value < dateFrom) onDateFromChange(value);
          }}
          className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
        />
      </div>
    </div>
  );
}
