# Ledger — Staff Desk (Upgraded)

A browser-based employee management ledger with salary, attendance, advances/settlements, expenses and reporting.

## Included flows

- Employee management with monthly salary and financial summary.
- Salary management with monthly records, pending/paid status and payment date.
- Attendance with Present, Half Day and Absent statuses.
- Employee advance and settlement transactions with running balance and permanent history.
- Dashboard daily/weekly/monthly expense summary.
- Reports screen for daily, weekly and monthly salary, expense, attendance and advance reports.
- Employee table showing salary, total expenses, advances, settlements and outstanding balance.
- Expense screen supports saved categories plus **Custom expense type** for admin-entered categories.
- Excel export/import for all modules.
- Browser local storage; no backend required.

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Important

Data is stored per browser/device. Export the Excel file regularly as a backup.

## Excel sheets

Employees, Salaries, Attendance, Advances, Expenses, Expense Categories.
