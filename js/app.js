(function () {
  "use strict";

  var STORE_KEYS = {
    employees: "ledger_employees",
    attendance: "ledger_attendance",
    expenses: "ledger_expenses",
    categories: "ledger_categories",
    salaries: "ledger_salaries",
    advances: "ledger_advances",
  };
  var DEFAULT_CATEGORIES = [
    "Travel",
    "Food",
    "Accommodation",
    "Office Supplies",
    "Other",
  ];
  var state = {
    employees: [],
    attendance: [],
    expenses: [],
    categories: [],
    salaries: [],
    advances: [],
  };
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function todayISO() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function currentMonth() {
    return todayISO().slice(0, 7);
  }
  function safeStorage() {
    try {
      localStorage.setItem("__ledger_test__", "1");
      localStorage.removeItem("__ledger_test__");
      return localStorage;
    } catch (e) {
      return null;
    }
  }
  var LS = safeStorage();
  function loadState() {
    if (!LS) return;
    try {
      state.employees = JSON.parse(LS.getItem(STORE_KEYS.employees) || "[]");
      state.attendance = JSON.parse(LS.getItem(STORE_KEYS.attendance) || "[]");
      state.expenses = JSON.parse(LS.getItem(STORE_KEYS.expenses) || "[]");
      state.categories =
        JSON.parse(LS.getItem(STORE_KEYS.categories) || "null") ||
        DEFAULT_CATEGORIES.slice();
      state.salaries = JSON.parse(LS.getItem(STORE_KEYS.salaries) || "[]");
      state.advances = JSON.parse(LS.getItem(STORE_KEYS.advances) || "[]");
      state.attendance.forEach(function (a) {
        if (a.status === "half") a.status = "half_day";
      });
    } catch (e) {
      state = {
        employees: [],
        attendance: [],
        expenses: [],
        categories: DEFAULT_CATEGORIES.slice(),
        salaries: [],
        advances: [],
      };
    }
  }
  function persist() {
    if (!LS) return;
    Object.keys(STORE_KEYS).forEach(function (k) {
      LS.setItem(STORE_KEYS[k], JSON.stringify(state[k]));
    });
  }
  function $(s, r) {
    return (r || document).querySelector(s);
  }
  function $all(s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function money(n) {
    return (
      "₹" +
      (Number(n) || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    );
  }
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    return isNaN(d)
      ? ""
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  }
  function employeeName(id) {
    if (!id) return "General / Unassigned";
    var e = state.employees.find(function (x) {
      return x.id === id;
    });
    return e ? e.name : "(removed employee)";
  }
  function employee(id) {
    return state.employees.find(function (x) {
      return x.id === id;
    });
  }
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      el.classList.remove("show");
    }, 2600);
  }
  var confirmResolve = null;
  function confirmDialog(title, body) {
    return new Promise(function (resolve) {
      $("#confirm-title").textContent = title;
      $("#confirm-body").textContent = body;
      $("#confirm-modal").classList.add("show");
      confirmResolve = resolve;
    });
  }
  $("#confirm-ok").addEventListener("click", function () {
    $("#confirm-modal").classList.remove("show");
    if (confirmResolve) confirmResolve(true);
  });
  $("#confirm-cancel").addEventListener("click", function () {
    $("#confirm-modal").classList.remove("show");
    if (confirmResolve) confirmResolve(false);
  });

  function goto(view) {
    $all(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === view);
    });
    $all(".view").forEach(function (v) {
      v.classList.toggle("active", v.id === "view-" + view);
    });
    var renders = {
      dashboard: renderDashboard,
      employees: renderEmployees,
      salary: renderSalaries,
      attendance: renderAttendance,
      advances: renderAdvances,
      expenses: renderExpenses,
      reports: renderReports,
      settings: renderSettings,
    };
    if (renders[view]) renders[view]();
  }
  $all(".nav-item").forEach(function (b) {
    b.addEventListener("click", function () {
      goto(b.dataset.view);
    });
  });
  $all("[data-goto]").forEach(function (b) {
    b.addEventListener("click", function () {
      goto(b.dataset.goto);
    });
  });

  function refreshEmployeeDropdowns() {
    var active = state.employees.filter(function (e) {
      return e.status === "active";
    });
    var opts = active
      .map(function (e) {
        return (
          '<option value="' +
          e.id +
          '">' +
          esc(e.name) +
          " — " +
          esc(e.location || "") +
          "</option>"
        );
      })
      .join("");
    [
      "#att-employee",
      "#exp-employee",
      "#adv-employee",
      "#salary-employee",
    ].forEach(function (id) {
      $(id).innerHTML = opts || '<option value="">No active employees</option>';
    });
    var all = state.employees
      .map(function (e) {
        return '<option value="' + e.id + '">' + esc(e.name) + "</option>";
      })
      .join("");
    [
      "#att-filter-employee",
      "#exp-filter-employee",
      "#adv-filter-employee",
      "#salary-filter-employee",
    ].forEach(function (id) {
      if ($(id))
        $(id).innerHTML = '<option value="all">All employees</option>' + all;
    });
  }
  function refreshCategoryDropdowns() {
    var opts = state.categories
      .map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + "</option>";
      })
      .join("");
    $("#exp-category").innerHTML =
      opts + '<option value="__custom__">Custom expense type...</option>';
    $("#exp-filter-category").innerHTML =
      '<option value="all">All categories</option>' +
      opts +
      '<option value="__custom__">Custom</option>';
  }
  function sum(arr, field) {
    return arr.reduce(function (s, x) {
      return s + (Number(x[field]) || 0);
    }, 0);
  }
  function periodRange(period, date) {
    var selectedDate = String(date || todayISO()).slice(0, 10);
    if (period === "daily") {
      return { start: selectedDate, end: selectedDate };
    }
    var d = new Date(selectedDate + "T00:00:00"),
      start = new Date(d),
      end = new Date(d);
    if (period === "weekly") {
      var day = d.getDay();
      start.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (period === "monthly") {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
  function inRange(date, range) {
    var value = String(date || "").slice(0, 10);
    return value >= range.start && value <= range.end;
  }
  function employeeAdvanceBalance(id) {
    return state.advances
      .filter(function (x) {
        return x.employeeId === id;
      })
      .reduce(function (s, x) {
        return (
          s +
          (x.type === "advance" ? Number(x.amount) : -(Number(x.amount) || 0))
        );
      }, 0);
  }
  function employeeExpenseTotal(id) {
    return sum(
      state.expenses.filter(function (x) {
        return x.employeeId === id;
      }),
      "amount",
    );
  }
  function employeeSettlementTotal(id) {
    return sum(
      state.advances.filter(function (x) {
        return x.employeeId === id && x.type === "settlement";
      }),
      "amount",
    );
  }

  function renderDashboard() {
    var t = todayISO(),
      active = state.employees.filter(function (e) {
        return e.status === "active";
      });
    var ta = state.attendance.filter(function (a) {
      return a.date === t;
    });
    var present = ta.filter(function (a) {
        return a.status === "present";
      }).length,
      half = ta.filter(function (a) {
        return a.status === "half_day";
      }).length,
      absent = ta.filter(function (a) {
        return a.status === "absent";
      }).length;
    var outstanding =
      sum(
        state.advances.filter(function (a) {
          return a.type === "advance";
        }),
        "amount",
      ) -
      sum(
        state.advances.filter(function (a) {
          return a.type === "settlement";
        }),
        "amount",
      );
    var mr = periodRange("monthly", t),
      monthExp = state.expenses.filter(function (x) {
        return inRange(x.date, mr);
      }),
      total = sum(monthExp, "amount");
    var wr = periodRange("weekly", t),
      weekExp = state.expenses.filter(function (x) {
        return inRange(x.date, wr);
      }),
      dayExp = state.expenses.filter(function (x) {
        return x.date === t;
      });
    $("#dash-date-line").textContent = "Snapshot for " + formatDate(t);
    $("#stat-active").textContent = active.length;
    $("#stat-total-sub").textContent =
      state.employees.length + " total on roll";
    $("#stat-present").textContent = present;
    $("#stat-present-sub").textContent =
      "of " + active.length + " active staff";
    $("#stat-half").textContent = half;
    $("#stat-advance").textContent = money(outstanding);
    $("#stat-advance-sub").textContent = "outstanding balance";
    $("#stat-expense").textContent = money(total);
    $("#stat-expense-sub").textContent =
      monthExp.length + " entries this month";
    $("#dash-day-expense").textContent = money(sum(dayExp, "amount"));
    $("#dash-week-expense").textContent = money(sum(weekExp, "amount"));
    $("#dash-month-expense").textContent = money(total);
    var rows = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(t + "T00:00:00");
      d.setDate(d.getDate() - i);
      var iso = d.toISOString().slice(0, 10),
        rec = state.attendance.filter(function (a) {
          return a.date === iso;
        });
      rows.push(
        "<tr><td>" +
          formatDate(iso) +
          "</td><td>" +
          rec.filter(function (a) {
            return a.status === "present";
          }).length +
          "</td><td>" +
          rec.filter(function (a) {
            return a.status === "half_day";
          }).length +
          "</td><td>" +
          rec.filter(function (a) {
            return a.status === "absent";
          }).length +
          "</td><td>" +
          rec.length +
          "</td></tr>",
      );
    }
    $("#dash-attendance-body").innerHTML = rows.join("");
    var activity = [];
    state.expenses.forEach(function (x) {
      activity.push({
        date: x.date,
        name: employeeName(x.employeeId),
        type: "Expense · " + x.category,
        amount: money(x.amount),
      });
    });
    state.advances.forEach(function (x) {
      activity.push({
        date: x.date,
        name: employeeName(x.employeeId),
        type: x.type === "advance" ? "Advance given" : "Settlement",
        amount: money(x.amount),
      });
    });
    state.salaries
      .filter(function (x) {
        return x.status === "paid";
      })
      .forEach(function (x) {
        activity.push({
          date: x.paymentDate || x.month + "-01",
          name: employeeName(x.employeeId),
          type: "Salary paid",
          amount: money(x.amount),
        });
      });
    activity.sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    $("#dash-activity-body").innerHTML =
      activity
        .slice(0, 8)
        .map(function (x) {
          return (
            "<tr><td>" +
            formatDate(x.date) +
            "</td><td>" +
            esc(x.name) +
            "</td><td>" +
            esc(x.type) +
            "</td><td>" +
            x.amount +
            "</td></tr>"
          );
        })
        .join("") || '<tr><td colspan="4">No recent activity</td></tr>';
  }

  var empFormStatus = "active";
  $("#emp-status-toggle").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-status]");
    if (!b) return;
    empFormStatus = b.dataset.status;
    $all("#emp-status-toggle button").forEach(function (x) {
      x.classList.remove("sel-active", "sel-inactive");
    });
    b.classList.add(empFormStatus === "active" ? "sel-active" : "sel-inactive");
  });
  $("#form-employee").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = $("#emp-edit-id").value,
      name = $("#emp-name").value.trim(),
      location = $("#emp-location").value.trim(),
      mobile = $("#emp-mobile").value.trim(),
      salary = Number($("#emp-salary").value),
      salaryType = $("#emp-salary-type").value,
      address = $("#emp-address").value.trim();
    if (!name || !location || !mobile || isNaN(salary) || salary < 0) {
      toast("Please complete the employee details.");
      return;
    }
    if (id) {
      var x = employee(id);
      if (x) {
        x.name = name;
        x.location = location;
        x.mobile = mobile;
        x.salary = salary;
        x.salaryType = salaryType;
        x.address = address;
        x.status = empFormStatus;
      }
      toast("Employee updated.");
    } else {
      state.employees.push({
        id: uid(),
        name: name,
        location: location,
        mobile: mobile,
        salary: salary,
        salaryType: salaryType,
        address: address,
        status: empFormStatus,
        createdAt: todayISO(),
      });
      toast("Employee added.");
    }
    persist();
    resetEmployeeForm();
    renderAll();
  });
  function resetEmployeeForm() {
    $("#form-employee").reset();
    $("#emp-edit-id").value = "";
    $("#emp-salary").value = "";
    $("#emp-salary-type").value = "monthly";
    empFormStatus = "active";
    $all("#emp-status-toggle button").forEach(function (b) {
      b.classList.remove("sel-active", "sel-inactive");
    });
    $("#emp-status-toggle button[data-status=active]").classList.add(
      "sel-active",
    );
    $("#emp-submit-btn").textContent = "Add employee";
    $("#emp-cancel-edit").style.display = "none";
  }
  function editEmployee(id) {
    var e = employee(id);
    if (!e) return;
    $("#emp-edit-id").value = e.id;
    $("#emp-name").value = e.name;
    $("#emp-location").value = e.location;
    $("#emp-mobile").value = e.mobile;
    $("#emp-salary").value = e.salary || 0;
    $("#emp-salary-type").value = e.salaryType || "monthly";
    $("#emp-address").value = e.address || "";
    empFormStatus = e.status || "active";
    $all("#emp-status-toggle button").forEach(function (b) {
      b.classList.remove("sel-active", "sel-inactive");
    });
    $(
      "#emp-status-toggle button[data-status=" + empFormStatus + "]",
    ).classList.add(empFormStatus === "active" ? "sel-active" : "sel-inactive");
    $("#emp-submit-btn").textContent = "Update employee";
    $("#emp-cancel-edit").style.display = "inline-flex";
    goto("employees");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#emp-cancel-edit").addEventListener("click", resetEmployeeForm);
  function deleteEmployee(id) {
    confirmDialog(
      "Archive this employee?",
      "The employee will be marked inactive and all salary, attendance, expense and advance history will be retained.",
    ).then(function (ok) {
      if (!ok) return;
      var e = employee(id);
      if (e) e.status = "inactive";
      persist();
      renderAll();
      toast("Employee archived. History retained.");
    });
  }
  function renderEmployees() {
    var search = ($("#emp-search").value || "").toLowerCase(),
      sf = $("#emp-filter-status").value;
    var list = state.employees.filter(function (e) {
      return (
        (!search ||
          e.name.toLowerCase().includes(search) ||
          e.location.toLowerCase().includes(search)) &&
        (sf === "all" || e.status === sf)
      );
    });
    $("#emp-count-label").textContent =
      state.employees.length +
      " employee" +
      (state.employees.length === 1 ? "" : "s");
    $("#employee-empty").style.display = list.length ? "none" : "block";
    $("#employee-body").innerHTML = list
      .map(function (e) {
        var exp = employeeExpenseTotal(e.id),
          adv = sum(
            state.advances.filter(function (x) {
              return x.employeeId === e.id && x.type === "advance";
            }),
            "amount",
          ),
          sett = employeeSettlementTotal(e.id),
          bal = employeeAdvanceBalance(e.id);
        return (
          "<tr><td><strong>" +
          esc(e.name) +
          "</strong><br><small>" +
          esc(e.mobile) +
          "</small></td><td>" +
          money(e.salary) +
          " / " +
          (e.salaryType || "monthly") +
          "</td><td>" +
          money(exp) +
          "</td><td>" +
          money(adv) +
          "</td><td>" +
          money(sett) +
          "</td><td>" +
          money(bal) +
          "</td><td>" +
          esc(e.location) +
          "<br><small>" +
          esc(e.address || "No address") +
          '</small></td><td><span class="pill pill-' +
          e.status +
          '">' +
          (e.status === "active" ? "Active" : "Inactive") +
          '</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="' +
          e.id +
          '">Edit</button><button class="icon-btn danger" data-del="' +
          e.id +
          '">Delete</button></div></td></tr>'
        );
      })
      .join("");
  }
  $("#employee-body").addEventListener("click", function (e) {
    var ed = e.target.closest("[data-edit]"),
      del = e.target.closest("[data-del]");
    if (ed) editEmployee(ed.dataset.edit);
    if (del) deleteEmployee(del.dataset.del);
  });
  $("#emp-search").addEventListener("input", renderEmployees);
  $("#emp-filter-status").addEventListener("change", renderEmployees);

  $("#form-salary").addEventListener("submit", function (e) {
    e.preventDefault();
    var emp = $("#salary-employee").value,
      month = $("#salary-month").value,
      amount = Number($("#salary-amount").value),
      status = $("#salary-status").value,
      pd = $("#salary-payment-date").value,
      notes = $("#salary-notes").value.trim();
    if (!emp || !month || isNaN(amount) || amount < 0) {
      toast("Complete the salary details.");
      return;
    }
    if (status === "paid" && !pd) pd = todayISO();
    var existing = state.salaries.find(function (x) {
      return x.employeeId === emp && x.month === month;
    });
    if (existing) {
      existing.amount = amount;
      existing.status = status;
      existing.paymentDate = pd;
      existing.notes = notes;
      toast("Salary record updated.");
    } else {
      state.salaries.push({
        id: uid(),
        employeeId: emp,
        month: month,
        amount: amount,
        status: status,
        paymentDate: pd,
        notes: notes,
      });
      toast("Salary record saved.");
    }
    persist();
    renderSalaries();
    renderDashboard();
  });
  function renderSalaries() {
    var ef = $("#salary-filter-employee").value,
      sf = $("#salary-filter-status").value,
      list = state.salaries
        .filter(function (x) {
          return (
            (ef === "all" || x.employeeId === ef) &&
            (sf === "all" || x.status === sf)
          );
        })
        .sort(function (a, b) {
          return b.month.localeCompare(a.month);
        });
    $("#salary-count-label").textContent =
      state.salaries.length +
      " record" +
      (state.salaries.length === 1 ? "" : "s");
    $("#salary-body").innerHTML = list
      .map(function (x) {
        return (
          "<tr><td>" +
          esc(x.month) +
          "</td><td>" +
          esc(employeeName(x.employeeId)) +
          "</td><td>" +
          money(x.amount) +
          '</td><td><span class="pill pill-' +
          x.status +
          '">' +
          (x.status === "paid" ? "Paid" : "Pending") +
          "</span></td><td>" +
          (x.paymentDate ? formatDate(x.paymentDate) : "—") +
          "</td><td>" +
          esc(x.notes || "—") +
          '</td><td><button class="icon-btn danger" data-del-salary="' +
          x.id +
          '">Delete</button></td></tr>'
        );
      })
      .join("");
  }
  $("#salary-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del-salary]");
    if (!b) return;
    confirmDialog(
      "Delete salary record?",
      "This salary history entry will be removed.",
    ).then(function (ok) {
      if (!ok) return;
      state.salaries = state.salaries.filter(function (x) {
        return x.id !== b.dataset.delSalary;
      });
      persist();
      renderSalaries();
      renderDashboard();
    });
  });
  $("#salary-filter-employee,#salary-filter-status").forEach ? null : null;
  ["salary-filter-employee", "salary-filter-status"].forEach(function (id) {
    $("#" + id).addEventListener("change", renderSalaries);
  });

  $all('input[name="att-status"]').forEach(function (r) {
    r.addEventListener("change", function () {
      var s = $('input[name="att-status"]:checked').value;
      $("#att-reason-field").style.display =
        s === "absent" || s === "half_day" ? "block" : "none";
    });
  });
  $("#form-attendance").addEventListener("submit", function (e) {
    e.preventDefault();
    var emp = $("#att-employee").value,
      date = $("#att-date").value,
      status = $('input[name="att-status"]:checked').value,
      reason = $("#att-reason").value.trim();
    if (!emp || !date) {
      toast("Select employee and date.");
      return;
    }
    var ex = state.attendance.find(function (a) {
      return a.employeeId === emp && a.date === date;
    });
    if (ex) {
      ex.status = status;
      ex.reason = reason;
    } else
      state.attendance.push({
        id: uid(),
        employeeId: emp,
        date: date,
        status: status,
        reason: reason,
      });
    persist();
    $("#form-attendance").reset();
    $("#att-date").value = date;
    $("#att-reason-field").style.display = "none";
    renderAttendance();
    renderDashboard();
    toast("Attendance saved.");
  });
  function renderAttendance() {
    var df = $("#att-filter-date").value,
      ef = $("#att-filter-employee").value,
      sf = $("#att-filter-status").value;
    var list = state.attendance
      .filter(function (a) {
        return (
          (!df || a.date === df) &&
          (ef === "all" || a.employeeId === ef) &&
          (sf === "all" || a.status === sf)
        );
      })
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    $("#att-count-label").textContent =
      state.attendance.length +
      " record" +
      (state.attendance.length === 1 ? "" : "s");
    $("#attendance-body").innerHTML = list
      .map(function (a) {
        var label =
          a.status === "half_day"
            ? "Half Day"
            : a.status.charAt(0).toUpperCase() + a.status.slice(1);
        return (
          "<tr><td>" +
          formatDate(a.date) +
          "</td><td>" +
          esc(employeeName(a.employeeId)) +
          '</td><td><span class="pill pill-' +
          a.status +
          '">' +
          label +
          "</span></td><td>" +
          esc(a.reason || "—") +
          '</td><td><button class="icon-btn danger" data-del-att="' +
          a.id +
          '">Delete</button></td></tr>'
        );
      })
      .join("");
  }
  $("#attendance-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del-att]");
    if (!b) return;
    confirmDialog("Delete attendance record?", "This cannot be undone.").then(
      function (ok) {
        if (!ok) return;
        state.attendance = state.attendance.filter(function (x) {
          return x.id !== b.dataset.delAtt;
        });
        persist();
        renderAttendance();
        renderDashboard();
      },
    );
  });
  ["att-filter-date", "att-filter-employee", "att-filter-status"].forEach(
    function (id) {
      $("#" + id).addEventListener("change", renderAttendance);
      $("#" + id).addEventListener("input", renderAttendance);
    },
  );

  $("#form-advance").addEventListener("submit", function (e) {
    e.preventDefault();
    var emp = $("#adv-employee").value,
      date = $("#adv-date").value,
      type = $("#adv-type").value,
      amount = Number($("#adv-amount").value),
      notes = $("#adv-notes").value.trim();
    if (!emp || !date || isNaN(amount) || amount <= 0) {
      toast("Complete the advance details.");
      return;
    }
    if (type === "settlement" && amount > employeeAdvanceBalance(emp)) {
      toast(
        "Settlement cannot be greater than the employee's outstanding advance.",
      );
      return;
    }
    state.advances.push({
      id: uid(),
      employeeId: emp,
      date: date,
      type: type,
      amount: amount,
      notes: notes,
    });
    persist();
    $("#form-advance").reset();
    $("#adv-date").value = date;
    renderAdvances();
    renderEmployees();
    renderDashboard();
    toast(type === "advance" ? "Advance recorded." : "Settlement recorded.");
  });
  function renderAdvances() {
    var ef = $("#adv-filter-employee").value,
      tf = $("#adv-filter-type").value,
      list = state.advances
        .filter(function (x) {
          return (
            (ef === "all" || x.employeeId === ef) &&
            (tf === "all" || x.type === tf)
          );
        })
        .sort(function (a, b) {
          return b.date.localeCompare(a.date);
        });
    var total = sum(
        state.advances.filter(function (x) {
          return x.type === "advance";
        }),
        "amount",
      ),
      sett = sum(
        state.advances.filter(function (x) {
          return x.type === "settlement";
        }),
        "amount",
      );
    $("#adv-total").textContent = money(total);
    $("#adv-settled").textContent = money(sett);
    $("#adv-outstanding").textContent = money(total - sett);
    $("#adv-count-label").textContent =
      state.advances.length +
      " transaction" +
      (state.advances.length === 1 ? "" : "s");
    var balances = {};
    state.advances
      .slice()
      .sort(function (a, b) {
        return a.date.localeCompare(b.date);
      })
      .forEach(function (x) {
        balances[x.employeeId] =
          (balances[x.employeeId] || 0) +
          (x.type === "advance" ? Number(x.amount) : -Number(x.amount));
        x._balance = balances[x.employeeId];
      });
    $("#advance-body").innerHTML = list
      .map(function (x) {
        return (
          "<tr><td>" +
          formatDate(x.date) +
          "</td><td>" +
          esc(employeeName(x.employeeId)) +
          '</td><td><span class="pill pill-' +
          x.type +
          '">' +
          (x.type === "advance" ? "Advance" : "Settlement") +
          "</span></td><td>" +
          money(x.amount) +
          "</td><td>" +
          money(x._balance) +
          "</td><td>" +
          esc(x.notes || "—") +
          '</td><td><button class="icon-btn danger" data-del-adv="' +
          x.id +
          '">Delete</button></td></tr>'
        );
      })
      .join("");
  }
  $("#advance-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del-adv]");
    if (!b) return;
    confirmDialog(
      "Delete this transaction?",
      "The employee balance will be recalculated.",
    ).then(function (ok) {
      if (!ok) return;
      state.advances = state.advances.filter(function (x) {
        return x.id !== b.dataset.delAdv;
      });
      persist();
      renderAdvances();
      renderEmployees();
      renderDashboard();
    });
  });
  ["adv-filter-employee", "adv-filter-type"].forEach(function (id) {
    $("#" + id).addEventListener("change", renderAdvances);
  });

  function setExpenseEntryMode(mode) {
    var manual = mode === "manual";
    $("#exp-employee-field").style.display = manual ? "none" : "flex";
    $("#exp-employee").required = !manual;
    $("#exp-category").style.display = manual ? "none" : "block";
    $("#exp-category").required = !manual;
    $("#exp-custom-field").style.display = manual ? "flex" : "none";
    $("#exp-custom-category").required = manual;
  }
  $("#exp-entry-mode").addEventListener("change", function () {
    setExpenseEntryMode(this.value);
  });
  $("#exp-category").addEventListener("change", function () {
    var custom = this.value === "__custom__";
    $("#exp-custom-field").style.display = custom ? "flex" : "none";
    $("#exp-custom-category").required = custom;
  });
  setExpenseEntryMode($("#exp-entry-mode").value);
  $("#form-expense").addEventListener("submit", function (e) {
    e.preventDefault();
    var emp = $("#exp-employee").value,
      date = $("#exp-date").value,
      entryMode = $("#exp-entry-mode").value,
      cat = $("#exp-category").value,
      custom = $("#exp-custom-category").value.trim(),
      amount = Number($("#exp-amount").value),
      reason = $("#exp-reason").value.trim();
    if (entryMode === "manual" || cat === "__custom__") cat = custom;
    if (
      (entryMode === "auto" && !emp) ||
      !date ||
      !cat ||
      isNaN(amount) ||
      amount <= 0 ||
      !reason
    ) {
      toast("Complete all expense fields.");
      return;
    }
    if (
      state.categories.indexOf(cat) === -1 &&
      $("#exp-category").value === "__custom__"
    ) {
    }
    state.expenses.push({
      id: uid(),
      employeeId: emp,
      date: date,
      category: cat,
      amount: amount,
      reason: reason,
      custom:
        entryMode === "manual" || $("#exp-category").value === "__custom__",
    });
    persist();
    $("#form-expense").reset();
    $("#exp-date").value = date;
    setExpenseEntryMode("auto");
    renderExpenses();
    renderEmployees();
    renderDashboard();
    toast("Expense saved.");
  });
  function renderExpenses() {
    var ef = $("#exp-filter-employee").value,
      cf = $("#exp-filter-category").value;
    var list = state.expenses
      .filter(function (x) {
        return (
          (ef === "all" || x.employeeId === ef) &&
          (cf === "all" || cf === "__custom__"
            ? cf === "all" || x.custom === true
            : x.category === cf)
        );
      })
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    $("#exp-count-label").textContent =
      state.expenses.length +
      " record" +
      (state.expenses.length === 1 ? "" : "s");
    $("#expense-body").innerHTML = list
      .map(function (x) {
        return (
          "<tr><td>" +
          formatDate(x.date) +
          "</td><td>" +
          esc(employeeName(x.employeeId)) +
          "</td><td>" +
          esc(x.category) +
          (x.custom ? ' <span class="pill pill-custom">Custom</span>' : "") +
          "</td><td>" +
          money(x.amount) +
          "</td><td>" +
          esc(x.reason) +
          '</td><td><button class="icon-btn danger" data-del-exp="' +
          x.id +
          '">Delete</button></td></tr>'
        );
      })
      .join("");
  }
  $("#expense-body").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del-exp]");
    if (!b) return;
    confirmDialog("Delete this expense?", "This cannot be undone.").then(
      function (ok) {
        if (!ok) return;
        state.expenses = state.expenses.filter(function (x) {
          return x.id !== b.dataset.delExp;
        });
        persist();
        renderExpenses();
        renderEmployees();
        renderDashboard();
      },
    );
  });
  ["exp-filter-employee", "exp-filter-category"].forEach(function (id) {
    $("#" + id).addEventListener("change", renderExpenses);
  });

  function reportData() {
    var p = $("#report-period").value,
      d = $("#report-date").value || todayISO(),
      r = periodRange(p, d);
    var ex = state.expenses.filter(function (x) {
        return inRange(x.date, r);
      }),
      sal = state.salaries.filter(function (x) {
        var salaryDate = x.paymentDate;
        if (!salaryDate && x.status === "paid") {
          salaryDate = x.month === d.slice(0, 7) ? d : x.month + "-01";
        }
        return inRange(salaryDate, r) && x.status === "paid";
      }),
      adv = state.advances.filter(function (x) {
        return inRange(x.date, r);
      });
    var att = state.attendance.filter(function (x) {
      return inRange(x.date, r);
    });
    return {
      period: p,
      date: d,
      range: r,
      expenses: ex,
      salaries: sal,
      advances: adv,
      attendance: att,
    };
  }
  function reportPeriodLabel(data) {
    if (data.period === "daily")
      return "Daily Report - " + formatDate(data.date);
    if (data.period === "weekly")
      return (
        "Weekly Report - " +
        formatDate(data.range.start) +
        " to " +
        formatDate(data.range.end)
      );
    return (
      "Monthly Report - " +
      formatDate(data.range.start) +
      " to " +
      formatDate(data.range.end)
    );
  }
  function renderReports() {
    var data = reportData(),
      ex = data.expenses,
      sal = data.salaries,
      adv = data.advances,
      r = data.range;
    $("#report-expense").textContent = money(sum(ex, "amount"));
    $("#report-expense-count").textContent = ex.length + " entries";
    $("#report-salary").textContent = money(sum(sal, "amount"));
    $("#report-advance").textContent = money(
      sum(
        adv.filter(function (x) {
          return x.type === "advance";
        }),
        "amount",
      ),
    );
    $("#report-settlement").textContent = money(
      sum(
        adv.filter(function (x) {
          return x.type === "settlement";
        }),
        "amount",
      ),
    );
    $("#report-attendance-body").innerHTML = state.employees
      .map(function (e) {
        var a = data.attendance.filter(function (x) {
          return x.employeeId === e.id;
        });
        return (
          "<tr><td>" +
          esc(e.name) +
          "</td><td>" +
          a.filter(function (x) {
            return x.status === "present";
          }).length +
          "</td><td>" +
          a.filter(function (x) {
            return x.status === "half_day";
          }).length +
          "</td><td>" +
          a.filter(function (x) {
            return x.status === "absent";
          }).length +
          "</td></tr>"
        );
      })
      .join("");
    $("#report-finance-body").innerHTML = state.employees
      .map(function (e) {
        var ee = ex.filter(function (x) {
            return x.employeeId === e.id;
          }),
          aa = adv.filter(function (x) {
            return x.employeeId === e.id;
          });
        var a = sum(
            aa.filter(function (x) {
              return x.type === "advance";
            }),
            "amount",
          ),
          s = sum(
            aa.filter(function (x) {
              return x.type === "settlement";
            }),
            "amount",
          );
        return (
          "<tr><td>" +
          esc(e.name) +
          "</td><td>" +
          money(sum(ee, "amount")) +
          "</td><td>" +
          money(a) +
          "</td><td>" +
          money(s) +
          "</td><td>" +
          money(a - s) +
          "</td></tr>"
        );
      })
      .join("");
  }

  // Lightweight, offline PDF generator. Uses standard PDF Helvetica so no external library is required.
  function pdfEscape(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[^\x20-\x7E]/g, "?");
  }
  function buildPdfDocument(pages) {
    var objects = [],
      offsets = [],
      pdf = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
    function obj(body) {
      objects.push(body);
      return objects.length;
    }
    var font = obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
      boldFont = obj(
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
      );
    var pageIds = [];
    pages.forEach(function (lines, pageIndex) {
      var content = "",
        y = 730,
        previousLine = "";
      function text(value, x, top, size, color, bold) {
        content +=
          "BT\n/" +
          (bold ? "F2" : "F1") +
          " " +
          size +
          " Tf\n" +
          color +
          " rg\n1 0 0 1 " +
          x +
          " " +
          top +
          " Tm\n(" +
          pdfEscape(value) +
          ") Tj\nET\n";
      }
      function band(top, height, color) {
        content +=
          color + " rg\n40 " + (top - height) + " 515 " + height + " re f\n";
      }
      band(802, 62, "0.10 0.17 0.20");
      text("MURUGAN METALS", 58, 778, 20, "1 1 1", true);
      text("EMPLOYEE MANAGEMENT REPORT", 58, 796, 8.5, "0.74 0.86 0.82", false);
      text(
        "Confidential business report",
        393,
        778,
        8,
        "0.82 0.88 0.86",
        false,
      );
      lines.forEach(function (line) {
        var isSection =
            /^(SUMMARY|ATTENDANCE|EMPLOYEE FINANCIAL SUMMARY|EXPENSE DETAILS|SALARY PAYMENTS|ADVANCE \/ SETTLEMENT HISTORY)$/.test(
              line,
            ),
          isTableHeader =
            line.indexOf("|") > -1 &&
            (/^Employee \|/.test(line) ||
              /^Date \|/.test(line) ||
              /^Month \|/.test(line));
        if (isSection) {
          y -= 7;
          band(y + 13, 19, "0.90 0.95 0.93");
          text(line, 50, y, 8.5, "0.10 0.40 0.32", true);
          y -= 20;
        } else if (isTableHeader) {
          band(y + 10, 17, "0.95 0.96 0.95");
          text(line, 48, y, 8, "0.20 0.27 0.29", true);
          y -= 17;
        } else if (line === "") {
          y -= 9;
        } else {
          text(line, 48, y, 8.5, "0.20 0.25 0.27", false);
          y -= 14;
        }
        previousLine = line;
      });
      content += "0.84 0.85 0.82 RG\n0.6 w\n40 48 m 555 48 l S\n";
      text(
        "MURUGAN METALS  |  Confidential",
        40,
        34,
        7.5,
        "0.36 0.41 0.42",
        false,
      );
      text(
        "Page " + (pageIndex + 1) + " of " + pages.length,
        493,
        34,
        7.5,
        "0.36 0.41 0.42",
        false,
      );
      var stream = obj(
        "<< /Length " +
          content.length +
          " >>\nstream\n" +
          content +
          "\nendstream",
      );
      var page = obj(
        "<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 " +
          font +
          " 0 R /F2 " +
          boldFont +
          " 0 R >> >> /Contents " +
          stream +
          " 0 R >>",
      );
      pageIds.push(page);
    });
    var kids = pageIds
      .map(function (id) {
        return id + " 0 R";
      })
      .join(" ");
    var pagesId = obj(
      "<< /Type /Pages /Kids [" + kids + "] /Count " + pageIds.length + " >>",
    );
    pageIds.forEach(function (id) {
      objects[id - 1] = objects[id - 1].replace(
        "/Parent 0 0 R",
        "/Parent " + pagesId + " 0 R",
      );
    });
    var catalog = obj("<< /Type /Catalog /Pages " + pagesId + " 0 R >>");
    objects.forEach(function (body, i) {
      offsets[i + 1] = pdf.length;
      pdf += i + 1 + " 0 obj\n" + body + "\nendobj\n";
    });
    var xref = pdf.length;
    pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
    for (var j = 1; j <= objects.length; j++)
      pdf += String(offsets[j]).padStart(10, "0") + " 00000 n \n";
    pdf +=
      "trailer\n<< /Size " +
      (objects.length + 1) +
      " /Root " +
      catalog +
      " 0 R >>\nstartxref\n" +
      xref +
      "\n%%EOF";
    return new Blob([pdf], { type: "application/pdf" });
  }
  function createReportPdfLines(data) {
    var ex = data.expenses,
      sal = data.salaries,
      adv = data.advances,
      att = data.attendance;
    var advAmt = sum(
        adv.filter(function (x) {
          return x.type === "advance";
        }),
        "amount",
      ),
      settAmt = sum(
        adv.filter(function (x) {
          return x.type === "settlement";
        }),
        "amount",
      );
    var lines = [
      "LEDGER - EMPLOYEE MANAGEMENT",
      reportPeriodLabel(data),
      "Generated: " + formatDate(todayISO()),
      "",
      "SUMMARY",
      "Expenses: Rs " +
        sum(ex, "amount").toLocaleString("en-IN") +
        "    Paid Salary: Rs " +
        sum(sal, "amount").toLocaleString("en-IN"),
      "Advances: Rs " +
        advAmt.toLocaleString("en-IN") +
        "    Settlements: Rs " +
        settAmt.toLocaleString("en-IN") +
        "    Outstanding: Rs " +
        (advAmt - settAmt).toLocaleString("en-IN"),
      "",
      "ATTENDANCE",
      "Employee | Present | Half Day | Absent",
    ];
    state.employees.forEach(function (e) {
      var a = att.filter(function (x) {
        return x.employeeId === e.id;
      });
      lines.push(
        (
          e.name +
          " | " +
          a.filter(function (x) {
            return x.status === "present";
          }).length +
          " | " +
          a.filter(function (x) {
            return x.status === "half_day";
          }).length +
          " | " +
          a.filter(function (x) {
            return x.status === "absent";
          }).length
        ).slice(0, 105),
      );
    });
    lines.push(
      "",
      "EMPLOYEE FINANCIAL SUMMARY",
      "Employee | Expense | Advance | Settlement | Balance",
    );
    state.employees.forEach(function (e) {
      var ee = ex.filter(function (x) {
          return x.employeeId === e.id;
        }),
        aa = adv.filter(function (x) {
          return x.employeeId === e.id;
        }),
        a = sum(
          aa.filter(function (x) {
            return x.type === "advance";
          }),
          "amount",
        ),
        s = sum(
          aa.filter(function (x) {
            return x.type === "settlement";
          }),
          "amount",
        );
      lines.push(
        (
          e.name +
          " | Rs " +
          sum(ee, "amount") +
          " | Rs " +
          a +
          " | Rs " +
          s +
          " | Rs " +
          (a - s)
        ).slice(0, 105),
      );
    });
    lines.push(
      "",
      "EXPENSE DETAILS",
      "Date | Employee | Type | Amount | Reason",
    );
    ex.slice()
      .sort(function (a, b) {
        return a.date.localeCompare(b.date);
      })
      .forEach(function (x) {
        lines.push(
          (
            formatDate(x.date) +
            " | " +
            employeeName(x.employeeId) +
            " | " +
            x.category +
            " | Rs " +
            x.amount +
            " | " +
            (x.reason || "")
          ).slice(0, 105),
        );
      });
    lines.push("", "SALARY PAYMENTS", "Month | Employee | Amount | Status");
    sal
      .slice()
      .sort(function (a, b) {
        return (a.paymentDate || a.month).localeCompare(
          b.paymentDate || b.month,
        );
      })
      .forEach(function (x) {
        lines.push(
          (
            x.month +
            " | " +
            employeeName(x.employeeId) +
            " | Rs " +
            x.amount +
            " | " +
            x.status
          ).slice(0, 105),
        );
      });
    lines.push(
      "",
      "ADVANCE / SETTLEMENT HISTORY",
      "Date | Employee | Type | Amount | Notes",
    );
    adv
      .slice()
      .sort(function (a, b) {
        return a.date.localeCompare(b.date);
      })
      .forEach(function (x) {
        lines.push(
          (
            formatDate(x.date) +
            " | " +
            employeeName(x.employeeId) +
            " | " +
            x.type +
            " | Rs " +
            x.amount +
            " | " +
            (x.notes || "")
          ).slice(0, 105),
        );
      });
    return lines;
  }
  function downloadReportPdf() {
    var data = reportData(),
      all = createReportPdfLines(data),
      pages = [];
    for (var i = 0; i < all.length; i += 40) pages.push(all.slice(i, i + 40));
    var blob = buildPdfDocument(pages),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "murugan-metals-" + data.period + "-report-" + data.date + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
    toast("PDF report downloaded.");
  }
  $("#report-period").addEventListener("change", renderReports);
  $("#report-date").addEventListener("change", renderReports);
  $("#btn-download-report-pdf").addEventListener("click", downloadReportPdf);

  function renderSettings() {
    $("#category-list").innerHTML =
      state.categories
        .map(function (c) {
          return (
            '<span class="tag">' +
            esc(c) +
            ' <button data-del-cat="' +
            esc(c) +
            '">&times;</button></span>'
          );
        })
        .join("") ||
      '<span style="color:var(--ink-soft);font-size:13px;">No categories yet.</span>';
  }
  $("#add-category-btn").addEventListener("click", function () {
    var i = $("#new-category-input"),
      v = i.value.trim();
    if (!v) return toast("Type a category name first.");
    if (
      state.categories.some(function (c) {
        return c.toLowerCase() === v.toLowerCase();
      })
    )
      return toast("That category already exists.");
    state.categories.push(v);
    i.value = "";
    persist();
    renderSettings();
    refreshCategoryDropdowns();
    toast("Category added.");
  });
  $("#new-category-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#add-category-btn").click();
    }
  });
  $("#category-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del-cat]");
    if (!b) return;
    var c = b.dataset.delCat;
    confirmDialog(
      'Remove "' + c + '"?',
      "Existing expenses keep their label.",
    ).then(function (ok) {
      if (!ok) return;
      state.categories = state.categories.filter(function (x) {
        return x !== c;
      });
      persist();
      renderSettings();
      refreshCategoryDropdowns();
    });
  });
  $("#btn-reset").addEventListener("click", function () {
    confirmDialog(
      "Erase all data?",
      "This deletes all employees, salary, attendance, advances and expenses. Export a backup first.",
    ).then(function (ok) {
      if (!ok) return;
      state = {
        employees: [],
        attendance: [],
        expenses: [],
        categories: DEFAULT_CATEGORIES.slice(),
        salaries: [],
        advances: [],
      };
      persist();
      renderAll();
      toast("All data erased.");
    });
  });

  function exportExcel() {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        state.employees.map(function (e) {
          return {
            Name: e.name,
            Location: e.location,
            Mobile: e.mobile,
            Salary: e.salary || 0,
            "Salary Frequency": e.salaryType || "monthly",
            Address: e.address || "",
            Status: e.status,
          };
        }),
      ),
      "Employees",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        state.salaries.map(function (x) {
          return {
            Month: x.month,
            Employee: employeeName(x.employeeId),
            Amount: x.amount,
            Status: x.status,
            "Payment Date": x.paymentDate || "",
            Notes: x.notes || "",
          };
        }),
      ),
      "Salaries",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        state.attendance.map(function (a) {
          return {
            Date: a.date,
            Employee: employeeName(a.employeeId),
            Status: a.status,
            Reason: a.reason || "",
          };
        }),
      ),
      "Attendance",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        state.advances.map(function (x) {
          return {
            Date: x.date,
            Employee: employeeName(x.employeeId),
            Type: x.type,
            Amount: x.amount,
            Notes: x.notes || "",
          };
        }),
      ),
      "Advances",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        state.expenses.map(function (x) {
          return {
            Date: x.date,
            Employee: x.employeeId ? employeeName(x.employeeId) : "",
            Category: x.category,
            Amount: x.amount,
            Reason: x.reason || "",
            Custom: x.custom ? "Yes" : "No",
          };
        }),
      ),
      "Expenses",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        state.categories.map(function (c) {
          return { Category: c };
        }),
      ),
      "Expense Categories",
    );
    XLSX.writeFile(wb, "employee-ledger-" + todayISO() + ".xlsx");
    toast("Excel file downloaded.");
  }
  function normalizeDate(v) {
    if (!v) return todayISO();
    if (typeof v === "number") {
      var d = XLSX.SSF.parse_date_code(v);
      return (
        d.y +
        "-" +
        String(d.m).padStart(2, "0") +
        "-" +
        String(d.d).padStart(2, "0")
      );
    }
    var d2 = new Date(v);
    return isNaN(d2) ? todayISO() : d2.toISOString().slice(0, 10);
  }
  function importExcel(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" }),
          nameToId = {},
          emps = [];
        if (wb.Sheets.Employees)
          XLSX.utils.sheet_to_json(wb.Sheets.Employees).forEach(function (r) {
            var n = String(r.Name || "").trim();
            if (!n) return;
            var id = uid(),
              salaryType =
                String(r["Salary Frequency"] || "monthly").toLowerCase() ===
                "daily"
                  ? "daily"
                  : "monthly";
            nameToId[n] = id;
            emps.push({
              id: id,
              name: n,
              location: String(r.Location || ""),
              mobile: String(r.Mobile || ""),
              salary: Number(r.Salary) || 0,
              salaryType: salaryType,
              address: String(r.Address || ""),
              status:
                String(r.Status || "active").toLowerCase() === "inactive"
                  ? "inactive"
                  : "active",
            });
          });
        var at = [],
          sa = [],
          av = [],
          ex = [];
        if (wb.Sheets.Attendance)
          XLSX.utils.sheet_to_json(wb.Sheets.Attendance).forEach(function (r) {
            var id = nameToId[String(r.Employee || "").trim()];
            if (id)
              at.push({
                id: uid(),
                employeeId: id,
                date: normalizeDate(r.Date),
                status:
                  String(r.Status || "present").toLowerCase() === "half_day"
                    ? "half_day"
                    : String(r.Status || "present").toLowerCase() === "absent"
                      ? "absent"
                      : "present",
                reason: String(r.Reason || ""),
              });
          });
        if (wb.Sheets.Salaries)
          XLSX.utils.sheet_to_json(wb.Sheets.Salaries).forEach(function (r) {
            var id = nameToId[String(r.Employee || "").trim()];
            if (id)
              sa.push({
                id: uid(),
                employeeId: id,
                month: String(r.Month || currentMonth()),
                amount: Number(r.Amount) || 0,
                status:
                  String(r.Status || "pending").toLowerCase() === "paid"
                    ? "paid"
                    : "pending",
                paymentDate: normalizeDate(r["Payment Date"]),
                notes: String(r.Notes || ""),
              });
          });
        if (wb.Sheets.Advances)
          XLSX.utils.sheet_to_json(wb.Sheets.Advances).forEach(function (r) {
            var id = nameToId[String(r.Employee || "").trim()];
            if (id)
              av.push({
                id: uid(),
                employeeId: id,
                date: normalizeDate(r.Date),
                type:
                  String(r.Type || "advance").toLowerCase() === "settlement"
                    ? "settlement"
                    : "advance",
                amount: Number(r.Amount) || 0,
                notes: String(r.Notes || ""),
              });
          });
        if (wb.Sheets.Expenses)
          XLSX.utils.sheet_to_json(wb.Sheets.Expenses).forEach(function (r) {
            var employeeValue = String(r.Employee || "").trim(),
              id = nameToId[employeeValue];
            if (id || !employeeValue)
              ex.push({
                id: uid(),
                employeeId: id || "",
                date: normalizeDate(r.Date),
                category: String(r.Category || "Other"),
                amount: Number(r.Amount) || 0,
                reason: String(r.Reason || ""),
                custom: String(r.Custom || "").toLowerCase() === "yes",
              });
          });
        var cats = [];
        if (wb.Sheets["Expense Categories"])
          XLSX.utils
            .sheet_to_json(wb.Sheets["Expense Categories"])
            .forEach(function (r) {
              var c = String(r.Category || "").trim();
              if (c && !cats.includes(c)) cats.push(c);
            });
        state = {
          employees: emps,
          attendance: at,
          expenses: ex,
          categories: cats.length ? cats : DEFAULT_CATEGORIES.slice(),
          salaries: sa,
          advances: av,
        };
        persist();
        renderAll();
        toast("Data imported from Excel.");
      } catch (err) {
        console.error(err);
        toast("Could not read that Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }
  function renderAll() {
    refreshEmployeeDropdowns();
    refreshCategoryDropdowns();
    renderDashboard();
    renderEmployees();
    renderSalaries();
    renderAttendance();
    renderAdvances();
    renderExpenses();
    renderReports();
    renderSettings();
  }
  $("#btn-export").addEventListener("click", exportExcel);
  $("#btn-export-2").addEventListener("click", exportExcel);
  $("#btn-import").addEventListener("click", function () {
    $("#file-import").click();
  });
  $("#btn-import-2").addEventListener("click", function () {
    $("#file-import").click();
  });
  $("#file-import").addEventListener("change", function (e) {
    if (e.target.files[0]) importExcel(e.target.files[0]);
    e.target.value = "";
  });
  function init() {
    loadState();
    if (!state.categories.length) state.categories = DEFAULT_CATEGORIES.slice();
    $("#att-date").value = todayISO();
    $("#exp-date").value = todayISO();
    $("#adv-date").value = todayISO();
    $("#salary-month").value = currentMonth();
    $("#report-date").value = todayISO();
    if (!LS) toast("Use Export/Import because local storage is unavailable.");
    renderAll();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
