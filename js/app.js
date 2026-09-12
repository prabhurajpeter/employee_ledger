(function () {
  "use strict";

  /* ---------------------------------------------------------
   * STATE
   * ------------------------------------------------------- */
  var STORE_KEYS = {
    employees: "ledger_employees",
    attendance: "ledger_attendance",
    expenses: "ledger_expenses",
    categories: "ledger_categories"
  };

  var DEFAULT_CATEGORIES = ["Travel", "Food", "Accommodation", "Office Supplies", "Other"];

  var state = {
    employees: [],
    attendance: [],
    expenses: [],
    categories: []
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function safeStorage() {
    try {
      var k = "__ledger_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return window.localStorage;
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
      state.categories = JSON.parse(LS.getItem(STORE_KEYS.categories) || "null") || DEFAULT_CATEGORIES.slice();
    } catch (e) {
      state.categories = DEFAULT_CATEGORIES.slice();
    }
  }

  function persist() {
    if (!LS) return;
    LS.setItem(STORE_KEYS.employees, JSON.stringify(state.employees));
    LS.setItem(STORE_KEYS.attendance, JSON.stringify(state.attendance));
    LS.setItem(STORE_KEYS.expenses, JSON.stringify(state.expenses));
    LS.setItem(STORE_KEYS.categories, JSON.stringify(state.categories));
  }

  /* ---------------------------------------------------------
   * UTIL: DOM helpers
   * ------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function formatMoney(n) {
    n = Number(n) || 0;
    return "\u20B9" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  function employeeName(id) {
    var e = state.employees.find(function (x) { return x.id === id; });
    return e ? e.name : "(removed employee)";
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
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

  /* ---------------------------------------------------------
   * NAVIGATION
   * ------------------------------------------------------- */
  function goto(view) {
    $all(".nav-item").forEach(function (b) { b.classList.toggle("active", b.dataset.view === view); });
    $all(".view").forEach(function (v) { v.classList.toggle("active", v.id === "view-" + view); });
    if (view === "dashboard") renderDashboard();
    if (view === "employees") renderEmployees();
    if (view === "attendance") renderAttendance();
    if (view === "expenses") renderExpenses();
    if (view === "settings") renderSettings();
  }
  $all(".nav-item[data-view]").forEach(function (btn) {
    btn.addEventListener("click", function () { goto(btn.dataset.view); });
  });
  $all("[data-goto]").forEach(function (btn) {
    btn.addEventListener("click", function () { goto(btn.dataset.goto); });
  });

  /* ---------------------------------------------------------
   * SHARED: populate employee dropdowns
   * ------------------------------------------------------- */
  function refreshEmployeeDropdowns() {
    var active = state.employees.filter(function (e) { return e.status === "active"; });
    var options = active.map(function (e) {
      return '<option value="' + e.id + '">' + esc(e.name) + " \u2014 " + esc(e.location) + "</option>";
    }).join("");

    $("#att-employee").innerHTML = options || '<option value="">No active employees</option>';
    $("#exp-employee").innerHTML = options || '<option value="">No active employees</option>';

    var allOptions = state.employees.map(function (e) {
      return '<option value="' + e.id + '">' + esc(e.name) + "</option>";
    }).join("");
    $("#att-filter-employee").innerHTML = '<option value="all">All employees</option>' + allOptions;
    $("#exp-filter-employee").innerHTML = '<option value="all">All employees</option>' + allOptions;
  }

  function refreshCategoryDropdowns() {
    var opts = state.categories.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
    $("#exp-category").innerHTML = opts || '<option value="">Add a category in Settings</option>';
    $("#exp-filter-category").innerHTML = '<option value="all">All categories</option>' + opts;
  }

  /* ---------------------------------------------------------
   * DASHBOARD
   * ------------------------------------------------------- */
  function renderDashboard() {
    var today = todayISO();
    $("#dash-date-line").textContent = "Snapshot for " + formatDate(today);

    var activeEmployees = state.employees.filter(function (e) { return e.status === "active"; });
    $("#stat-active").textContent = activeEmployees.length;
    $("#stat-total-sub").textContent = state.employees.length + " total on roll";

    var todaysAtt = state.attendance.filter(function (a) { return a.date === today; });
    var present = todaysAtt.filter(function (a) { return a.status === "present"; }).length;
    var absent = todaysAtt.filter(function (a) { return a.status === "absent"; }).length;
    $("#stat-present").textContent = present;
    $("#stat-present-sub").textContent = "of " + activeEmployees.length + " active staff";
    $("#stat-absent").textContent = absent;
    $("#stat-absent-sub").textContent = absent + " reason" + (absent === 1 ? "" : "s") + " logged";

    var monthPrefix = today.slice(0, 7);
    var monthExpenses = state.expenses.filter(function (x) { return x.date && x.date.slice(0, 7) === monthPrefix; });
    var total = monthExpenses.reduce(function (s, x) { return s + Number(x.amount || 0); }, 0);
    $("#stat-expense").textContent = formatMoney(total);
    $("#stat-expense-sub").textContent = monthExpenses.length + " entries this month";

    // last 7 days attendance table
    var rows = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var iso = d.toISOString().slice(0, 10);
      var dayRecs = state.attendance.filter(function (a) { return a.date === iso; });
      var p = dayRecs.filter(function (a) { return a.status === "present"; }).length;
      var a = dayRecs.filter(function (a) { return a.status === "absent"; }).length;
      rows.push("<tr><td>" + formatDate(iso) + "</td><td>" + p + "</td><td>" + a + "</td><td>" + dayRecs.length + "</td></tr>");
    }
    $("#dash-attendance-body").innerHTML = rows.join("");

    var recentExp = state.expenses.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).slice(0, 6);
    $("#dash-expense-body").innerHTML = recentExp.length ? recentExp.map(function (x) {
      return "<tr><td>" + esc(employeeName(x.employeeId)) + "</td><td>" + esc(x.category) + "</td><td>" + formatMoney(x.amount) + "</td></tr>";
    }).join("") : '<tr><td colspan="3" style="color:var(--ink-soft);">No expenses logged yet</td></tr>';
  }

  /* ---------------------------------------------------------
   * EMPLOYEES
   * ------------------------------------------------------- */
  var empFormStatus = "active";
  $("#emp-status-toggle").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-status]");
    if (!btn) return;
    empFormStatus = btn.dataset.status;
    $all("#emp-status-toggle button").forEach(function (b) {
      b.classList.remove("sel-active", "sel-inactive");
    });
    btn.classList.add(empFormStatus === "active" ? "sel-active" : "sel-inactive");
  });

  $("#form-employee").addEventListener("submit", function (e) {
    e.preventDefault();
    var editId = $("#emp-edit-id").value;
    var name = $("#emp-name").value.trim();
    var location = $("#emp-location").value.trim();
    var mobile = $("#emp-mobile").value.trim();
    var address = $("#emp-address").value.trim();
    if (!name || !location || !mobile) { toast("Please fill all required fields."); return; }

    if (editId) {
      var emp = state.employees.find(function (x) { return x.id === editId; });
      if (emp) {
        emp.name = name; emp.location = location; emp.mobile = mobile;
        emp.address = address; emp.status = empFormStatus;
      }
      toast("Employee updated.");
    } else {
      state.employees.push({ id: uid(), name: name, location: location, mobile: mobile, address: address, status: empFormStatus });
      toast("Employee added.");
    }
    persist();
    resetEmployeeForm();
    renderEmployees();
    refreshEmployeeDropdowns();
  });

  function resetEmployeeForm() {
    $("#form-employee").reset();
    $("#emp-edit-id").value = "";
    empFormStatus = "active";
    $all("#emp-status-toggle button").forEach(function (b) { b.classList.remove("sel-active", "sel-inactive"); });
    $('#emp-status-toggle button[data-status="active"]').classList.add("sel-active");
    $("#emp-submit-btn").textContent = "Add employee";
    $("#emp-cancel-edit").style.display = "none";
  }
  $("#emp-cancel-edit").addEventListener("click", resetEmployeeForm);

  function editEmployee(id) {
    var emp = state.employees.find(function (x) { return x.id === id; });
    if (!emp) return;
    $("#emp-edit-id").value = emp.id;
    $("#emp-name").value = emp.name;
    $("#emp-location").value = emp.location;
    $("#emp-mobile").value = emp.mobile;
    $("#emp-address").value = emp.address || "";
    empFormStatus = emp.status;
    $all("#emp-status-toggle button").forEach(function (b) { b.classList.remove("sel-active", "sel-inactive"); });
    $('#emp-status-toggle button[data-status="' + emp.status + '"]').classList.add(emp.status === "active" ? "sel-active" : "sel-inactive");
    $("#emp-submit-btn").textContent = "Save changes";
    $("#emp-cancel-edit").style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteEmployee(id) {
    confirmDialog("Remove this employee?", "Their attendance and expense history will be kept but shown as a removed employee.").then(function (ok) {
      if (!ok) return;
      state.employees = state.employees.filter(function (x) { return x.id !== id; });
      persist();
      renderEmployees();
      refreshEmployeeDropdowns();
      toast("Employee removed.");
    });
  }

  function renderEmployees() {
    var search = ($("#emp-search").value || "").toLowerCase();
    var statusFilter = $("#emp-filter-status").value;
    var list = state.employees.filter(function (e) {
      var matchesSearch = !search || e.name.toLowerCase().indexOf(search) > -1 || e.location.toLowerCase().indexOf(search) > -1;
      var matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    $("#emp-count-label").textContent = state.employees.length + " employee" + (state.employees.length === 1 ? "" : "s");
    $("#employee-empty").style.display = list.length ? "none" : "block";

    $("#employee-body").innerHTML = list.map(function (e) {
      return "<tr>" +
        "<td>" + esc(e.name) + "</td>" +
        "<td>" + esc(e.location) + "</td>" +
        "<td>" + esc(e.mobile) + "</td>" +
        "<td>" + esc(e.address || "\u2014") + "</td>" +
        '<td><span class="pill pill-' + e.status + '">' + (e.status === "active" ? "Active" : "Inactive") + "</span></td>" +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-edit="' + e.id + '">Edit</button>' +
        '<button class="icon-btn danger" data-del="' + e.id + '">Delete</button>' +
        "</div></td>" +
        "</tr>";
    }).join("");
  }

  $("#employee-body").addEventListener("click", function (e) {
    var editBtn = e.target.closest("[data-edit]");
    var delBtn = e.target.closest("[data-del]");
    if (editBtn) editEmployee(editBtn.dataset.edit);
    if (delBtn) deleteEmployee(delBtn.dataset.del);
  });
  $("#emp-search").addEventListener("input", renderEmployees);
  $("#emp-filter-status").addEventListener("change", renderEmployees);

  /* ---------------------------------------------------------
   * ATTENDANCE
   * ------------------------------------------------------- */
  $all('input[name="att-status"]').forEach(function (r) {
    r.addEventListener("change", function () {
      $("#att-reason-field").style.display = $('input[name="att-status"]:checked').value === "absent" ? "block" : "none";
    });
  });

  $("#form-attendance").addEventListener("submit", function (e) {
    e.preventDefault();
    var employeeId = $("#att-employee").value;
    var date = $("#att-date").value;
    var status = $('input[name="att-status"]:checked').value;
    var reason = $("#att-reason").value.trim();
    if (!employeeId || !date) { toast("Select an employee and date."); return; }
    if (status === "absent" && !reason) { toast("Please add a reason for the absence."); return; }

    var existing = state.attendance.find(function (a) { return a.employeeId === employeeId && a.date === date; });
    if (existing) {
      existing.status = status;
      existing.reason = status === "absent" ? reason : "";
      toast("Attendance updated for this date.");
    } else {
      state.attendance.push({ id: uid(), employeeId: employeeId, date: date, status: status, reason: status === "absent" ? reason : "" });
      toast("Attendance saved.");
    }
    persist();
    $("#form-attendance").reset();
    $("#att-date").value = date;
    $("#att-reason-field").style.display = "none";
    renderAttendance();
    renderDashboard();
  });

  function deleteAttendance(id) {
    confirmDialog("Delete this attendance record?", "This cannot be undone.").then(function (ok) {
      if (!ok) return;
      state.attendance = state.attendance.filter(function (x) { return x.id !== id; });
      persist();
      renderAttendance();
      renderDashboard();
      toast("Record deleted.");
    });
  }

  function renderAttendance() {
    var dateFilter = $("#att-filter-date").value;
    var empFilter = $("#att-filter-employee").value;
    var statusFilter = $("#att-filter-status").value;

    var list = state.attendance.filter(function (a) {
      return (!dateFilter || a.date === dateFilter) &&
        (empFilter === "all" || a.employeeId === empFilter) &&
        (statusFilter === "all" || a.status === statusFilter);
    }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

    $("#att-count-label").textContent = state.attendance.length + " record" + (state.attendance.length === 1 ? "" : "s");
    $("#attendance-empty").style.display = list.length ? "none" : "block";

    $("#attendance-body").innerHTML = list.map(function (a) {
      return "<tr>" +
        "<td>" + formatDate(a.date) + "</td>" +
        "<td>" + esc(employeeName(a.employeeId)) + "</td>" +
        '<td><span class="pill pill-' + a.status + '">' + (a.status === "present" ? "Present" : "Absent") + "</span></td>" +
        "<td>" + esc(a.reason || "\u2014") + "</td>" +
        '<td><button class="icon-btn danger" data-del-att="' + a.id + '">Delete</button></td>' +
        "</tr>";
    }).join("");
  }
  $("#attendance-body").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-del-att]");
    if (btn) deleteAttendance(btn.dataset.delAtt);
  });
  ["att-filter-date", "att-filter-employee", "att-filter-status"].forEach(function (id) {
    $("#" + id).addEventListener("input", renderAttendance);
    $("#" + id).addEventListener("change", renderAttendance);
  });

  /* ---------------------------------------------------------
   * EXPENSES
   * ------------------------------------------------------- */
  $("#form-expense").addEventListener("submit", function (e) {
    e.preventDefault();
    var employeeId = $("#exp-employee").value;
    var date = $("#exp-date").value;
    var category = $("#exp-category").value;
    var amount = parseFloat($("#exp-amount").value);
    var reason = $("#exp-reason").value.trim();
    if (!employeeId || !date || !category || !reason || isNaN(amount) || amount <= 0) {
      toast("Please fill all required fields with a valid amount.");
      return;
    }
    state.expenses.push({ id: uid(), employeeId: employeeId, date: date, category: category, amount: amount, reason: reason });
    persist();
    $("#form-expense").reset();
    $("#exp-date").value = date;
    renderExpenses();
    renderDashboard();
    toast("Expense saved.");
  });

  function deleteExpense(id) {
    confirmDialog("Delete this expense?", "This cannot be undone.").then(function (ok) {
      if (!ok) return;
      state.expenses = state.expenses.filter(function (x) { return x.id !== id; });
      persist();
      renderExpenses();
      renderDashboard();
      toast("Expense deleted.");
    });
  }

  function renderExpenses() {
    var empFilter = $("#exp-filter-employee").value;
    var catFilter = $("#exp-filter-category").value;
    var list = state.expenses.filter(function (x) {
      return (empFilter === "all" || x.employeeId === empFilter) &&
        (catFilter === "all" || x.category === catFilter);
    }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

    $("#exp-count-label").textContent = state.expenses.length + " record" + (state.expenses.length === 1 ? "" : "s");
    $("#expense-empty").style.display = list.length ? "none" : "block";

    $("#expense-body").innerHTML = list.map(function (x) {
      return "<tr>" +
        "<td>" + formatDate(x.date) + "</td>" +
        "<td>" + esc(employeeName(x.employeeId)) + "</td>" +
        "<td>" + esc(x.category) + "</td>" +
        "<td>" + formatMoney(x.amount) + "</td>" +
        "<td>" + esc(x.reason) + "</td>" +
        '<td><button class="icon-btn danger" data-del-exp="' + x.id + '">Delete</button></td>' +
        "</tr>";
    }).join("");
  }
  $("#expense-body").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-del-exp]");
    if (btn) deleteExpense(btn.dataset.delExp);
  });
  ["exp-filter-employee", "exp-filter-category"].forEach(function (id) {
    $("#" + id).addEventListener("change", renderExpenses);
  });

  /* ---------------------------------------------------------
   * SETTINGS
   * ------------------------------------------------------- */
  function renderSettings() {
    $("#category-list").innerHTML = state.categories.map(function (c) {
      return '<span class="tag">' + esc(c) + ' <button data-del-cat="' + esc(c) + '" title="Remove">&times;</button></span>';
    }).join("") || '<span style="color:var(--ink-soft);font-size:13px;">No categories yet \u2014 add one below.</span>';
  }

  $("#add-category-btn").addEventListener("click", function () {
    var input = $("#new-category-input");
    var val = input.value.trim();
    if (!val) { toast("Type a category name first."); return; }
    if (state.categories.some(function (c) { return c.toLowerCase() === val.toLowerCase(); })) {
      toast("That category already exists.");
      return;
    }
    state.categories.push(val);
    persist();
    input.value = "";
    renderSettings();
    refreshCategoryDropdowns();
    toast("Category added.");
  });
  $("#new-category-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("#add-category-btn").click(); }
  });

  $("#category-list").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-del-cat]");
    if (!btn) return;
    var cat = btn.dataset.delCat;
    confirmDialog('Remove "' + cat + '"?', "Existing expenses already using this category keep their label.").then(function (ok) {
      if (!ok) return;
      state.categories = state.categories.filter(function (c) { return c !== cat; });
      persist();
      renderSettings();
      refreshCategoryDropdowns();
      toast("Category removed.");
    });
  });

  $("#btn-reset").addEventListener("click", function () {
    confirmDialog("Erase all data?", "This deletes every employee, attendance record and expense stored in this browser. Export a backup first if you need one.").then(function (ok) {
      if (!ok) return;
      state.employees = [];
      state.attendance = [];
      state.expenses = [];
      state.categories = DEFAULT_CATEGORIES.slice();
      persist();
      renderAll();
      toast("All data erased.");
    });
  });

  /* ---------------------------------------------------------
   * EXCEL EXPORT / IMPORT
   * ------------------------------------------------------- */
  function exportExcel() {
    var wb = XLSX.utils.book_new();

    var empSheet = XLSX.utils.json_to_sheet(state.employees.map(function (e) {
      return { Name: e.name, Location: e.location, Mobile: e.mobile, Address: e.address || "", Status: e.status };
    }));
    XLSX.utils.book_append_sheet(wb, empSheet, "Employees");

    var attSheet = XLSX.utils.json_to_sheet(state.attendance.map(function (a) {
      return { Date: a.date, Employee: employeeName(a.employeeId), Status: a.status, Reason: a.reason || "" };
    }));
    XLSX.utils.book_append_sheet(wb, attSheet, "Attendance");

    var expSheet = XLSX.utils.json_to_sheet(state.expenses.map(function (x) {
      return { Date: x.date, Employee: employeeName(x.employeeId), Category: x.category, Amount: x.amount, Reason: x.reason };
    }));
    XLSX.utils.book_append_sheet(wb, expSheet, "Expenses");

    var catSheet = XLSX.utils.json_to_sheet(state.categories.map(function (c) { return { Category: c }; }));
    XLSX.utils.book_append_sheet(wb, catSheet, "Expense Categories");

    var stamp = todayISO();
    XLSX.writeFile(wb, "employee-ledger-" + stamp + ".xlsx");
    toast("Excel file downloaded.");
  }

  function importExcel(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        var newEmployees = [];
        var nameToId = {};

        if (wb.Sheets["Employees"]) {
          XLSX.utils.sheet_to_json(wb.Sheets["Employees"]).forEach(function (row) {
            var id = uid();
            var name = String(row.Name || "").trim();
            if (!name) return;
            nameToId[name] = id;
            newEmployees.push({
              id: id,
              name: name,
              location: String(row.Location || "").trim(),
              mobile: String(row.Mobile || "").trim(),
              address: String(row.Address || "").trim(),
              status: (String(row.Status || "active").toLowerCase() === "inactive") ? "inactive" : "active"
            });
          });
        }

        var newAttendance = [];
        if (wb.Sheets["Attendance"]) {
          XLSX.utils.sheet_to_json(wb.Sheets["Attendance"]).forEach(function (row) {
            var empName = String(row.Employee || "").trim();
            var empId = nameToId[empName];
            if (!empId) return;
            var status = String(row.Status || "present").toLowerCase() === "absent" ? "absent" : "present";
            newAttendance.push({
              id: uid(),
              employeeId: empId,
              date: normalizeDate(row.Date),
              status: status,
              reason: String(row.Reason || "").trim()
            });
          });
        }

        var newExpenses = [];
        if (wb.Sheets["Expenses"]) {
          XLSX.utils.sheet_to_json(wb.Sheets["Expenses"]).forEach(function (row) {
            var empName = String(row.Employee || "").trim();
            var empId = nameToId[empName];
            if (!empId) return;
            newExpenses.push({
              id: uid(),
              employeeId: empId,
              date: normalizeDate(row.Date),
              category: String(row.Category || "Other").trim(),
              amount: Number(row.Amount) || 0,
              reason: String(row.Reason || "").trim()
            });
          });
        }

        var newCategories = state.categories.slice();
        if (wb.Sheets["Expense Categories"]) {
          XLSX.utils.sheet_to_json(wb.Sheets["Expense Categories"]).forEach(function (row) {
            var c = String(row.Category || "").trim();
            if (c && newCategories.indexOf(c) === -1) newCategories.push(c);
          });
        }

        state.employees = newEmployees;
        state.attendance = newAttendance;
        state.expenses = newExpenses;
        state.categories = newCategories.length ? newCategories : DEFAULT_CATEGORIES.slice();
        persist();
        renderAll();
        toast("Data imported from Excel.");
      } catch (err) {
        console.error(err);
        toast("Could not read that file. Make sure it's a .xlsx exported from this app.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function normalizeDate(val) {
    if (val == null || val === "") return todayISO();
    if (typeof val === "number") {
      var d = XLSX.SSF.parse_date_code(val);
      return d.y + "-" + String(d.m).padStart(2, "0") + "-" + String(d.d).padStart(2, "0");
    }
    var s = String(val).trim();
    var d2 = new Date(s);
    if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
    return todayISO();
  }

  $("#btn-export").addEventListener("click", exportExcel);
  $("#btn-export-2").addEventListener("click", exportExcel);
  $("#btn-import").addEventListener("click", function () { $("#file-import").click(); });
  $("#btn-import-2").addEventListener("click", function () { $("#file-import").click(); });
  $("#file-import").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (file) importExcel(file);
    e.target.value = "";
  });

  /* ---------------------------------------------------------
   * INIT
   * ------------------------------------------------------- */
  function renderAll() {
    refreshEmployeeDropdowns();
    refreshCategoryDropdowns();
    renderDashboard();
    renderEmployees();
    renderAttendance();
    renderExpenses();
    renderSettings();
  }

  function init() {
    loadState();
    if (!state.categories.length) state.categories = DEFAULT_CATEGORIES.slice();
    $("#att-date").value = todayISO();
    $("#exp-date").value = todayISO();
    if (!LS) {
      toast("Note: this browser blocks local storage for files opened directly. Use Export/Import to keep your data.");
    }
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
