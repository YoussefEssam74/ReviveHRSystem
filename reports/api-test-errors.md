# API Test Errors

Test rerun date: 2026-11-27. The integration suite ran first, followed by the security suite. This report lists every failed test with its assertion/error message and stack trace.

## Summary

- Integration: 6 failed, 728 passed, 734 total.
- Security: 98 failed, 1,146 passed, 1,244 total.

## Integration errors

### 1. `ReviveHRSystem.IntegrationTests.UnscheduledAttendanceTests.Approve_WithInvalidCalculatedDays_Returns400`

**Error**

```text
Assert.Equal() Failure: Values differ
Expected: BadRequest
Actual:   NoContent
```

**Stack trace**

```text
at ReviveHRSystem.IntegrationTests.UnscheduledAttendanceTests.Approve_WithInvalidCalculatedDays_Returns400() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.IntegrationTests\UnscheduledAttendanceTests.cs:line 253
--- End of stack trace from previous location ---
```

### 2. `ReviveHRSystem.IntegrationTests.ShiftCyclesControllerTests.Publish_WithConflict_WarnsInMessage`

**Error**

```text
Assert.Contains() Failure: Sub-string not found
String:    "Schedule published."
Not found: "unresolved conflict"
```

**Stack trace**

```text
at ReviveHRSystem.IntegrationTests.ShiftCyclesControllerTests.Publish_WithConflict_WarnsInMessage() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.IntegrationTests\ShiftCyclesControllerTests.cs:line 420
--- End of stack trace from previous location ---
```

### 3. `ReviveHRSystem.IntegrationTests.PayrollControllerTests.GetPeriodDetail_ReturnsEntryRowsWithLines`

**Error**

```text
Assert.Equal() Failure: Values differ
Expected: 1
Actual:   0
```

**Stack trace**

```text
at ReviveHRSystem.IntegrationTests.PayrollControllerTests.GetPeriodDetail_ReturnsEntryRowsWithLines() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.IntegrationTests\PayrollControllerTests.cs:line 388
--- End of stack trace from previous location ---
```

### 4. `ReviveHRSystem.IntegrationTests.KioskControllerTests.StationLogout_RevokesSession_AndClearsCookie`

**Error**

```text
Assert.Equal() Failure: Values differ
Expected: NoContent
Actual:   InternalServerError
```

**Stack trace**

```text
at ReviveHRSystem.IntegrationTests.KioskControllerTests.StationLogout_RevokesSession_AndClearsCookie() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.IntegrationTests\KioskControllerTests.cs:line 195
--- End of stack trace from previous location ---
```

### 5. `ReviveHRSystem.IntegrationTests.ShiftCyclesControllerTests.GetConflicts_ReturnsApprovedDayOffOverlap`

**Error**

```text
Assert.Equal() Failure: Values differ
Expected: 1
Actual:   0
```

**Stack trace**

```text
at ReviveHRSystem.IntegrationTests.ShiftCyclesControllerTests.GetConflicts_ReturnsApprovedDayOffOverlap() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.IntegrationTests\ShiftCyclesControllerTests.cs:line 458
--- End of stack trace from previous location ---
```

### 6. `ReviveHRSystem.IntegrationTests.AuthControllerTests.Logout_WithoutToken_Returns401`

**Error**

```text
Assert.Equal() Failure: Values differ
Expected: Unauthorized
Actual:   NoContent
```

**Stack trace**

```text
at ReviveHRSystem.IntegrationTests.AuthControllerTests.Logout_WithoutToken_Returns401() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.IntegrationTests\AuthControllerTests.cs:line 235
--- End of stack trace from previous location ---
```

## Security errors

### 1. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 2. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 3. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 4. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 5. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 6. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 7. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 8. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 9. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 10. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 11. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 12. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 13. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 14. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 15. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 16. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 17. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 18. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 19. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 20. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 21. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 9, identityKey: "hr")`

**Error**

```text
MATRIX VIOLATION POST /api/employees/3/position-change
identity = hr
expected = 401 | 404
actual   = 400
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 22. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 50, identityKey: "teamLeader")`

**Error**

```text
MATRIX VIOLATION GET /api/requests
identity = teamLeader
expected = 200
actual   = 401
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 23. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 24. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 25. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 26. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 27. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 28. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 29. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 30. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 31. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 11, identityKey: "hr")`

**Error**

```text
MATRIX VIOLATION POST /api/employees/3/contract
identity = hr
expected = 401 | 404
actual   = 200
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 32. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 33. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 34. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 35. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 36. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 37. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 38. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 39. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 40. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 41. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 42. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 43. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 44. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 45. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 46. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 47. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 50, identityKey: "branchManager")`

**Error**

```text
MATRIX VIOLATION GET /api/requests
identity = branchManager
expected = 200
actual   = 401
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 48. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 49. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 50. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 51. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 52. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 53. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 54. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 55. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 56. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 57. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 58. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 59. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 60. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 61. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 62. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 63. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 64. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 65. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 66. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 67. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 47, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decisions. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 68. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 69. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 70. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 71. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 72. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 73. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 74. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 75. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 76. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 77. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 57, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/restore. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 78. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "employeeOther")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 79. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 80. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 52, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 81. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 82. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 54, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/undo-decision. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 83. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 55, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/bulk-decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 84. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 85. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 49, identityKey: "teamLeader")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/comments. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 86. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 87. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 56, identityKey: "branchManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/archive. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 88. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "crossTenantTwin")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 89. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 48, identityKey: "hr")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: PUT /api/requests/{p}. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 90. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 8, identityKey: "hr")`

**Error**

```text
MATRIX VIOLATION POST /api/employees/3/transfer
identity = hr
expected = 401 | 404
actual   = 400
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 91. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 10, identityKey: "hr")`

**Error**

```text
MATRIX VIOLATION POST /api/employees/3/compensation
identity = hr
expected = 401 | 404
actual   = 200
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 92. `ReviveHRSystem.SecurityTests.EndpointEnumerationTests.Every_Mapped_Route_Is_Classified_And_Default_Deny_Holds`

**Error**

```text
Unmapped employees-family endpoints:
  GET api/employees/leave-defaults — employees-family route missing from access-matrix.json
  GET api/requests/summary — employees-family route missing from access-matrix.json
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.EndpointEnumerationTests.Every_Mapped_Route_Is_Classified_And_Default_Deny_Holds() in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\EndpointEnumerationTests.cs:line 108
--- End of stack trace from previous location ---
```

### 93. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "anonymous")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 94. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "hrManager")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 95. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 96. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 12, identityKey: "hr")`

**Error**

```text
MATRIX VIOLATION POST /api/employees/3/role-change
identity = hr
expected = 401 | 404
actual   = 200
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 64
--- End of stack trace from previous location ---
```

### 97. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 58, identityKey: "topManagement")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/employees/{p}/messages. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```

### 98. `ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(rowId: 53, identityKey: "employeeSelf")`

**Error**

```text
System.InvalidOperationException : No payload defined for matrix route: POST /api/requests/{p}/decide. Add it in EndpointPayloads so the 2xx path stays reachable.
```

**Stack trace**

```text
at ReviveHRSystem.SecurityTests.Support.EndpointPayloads.Build(String method, String routeTemplate, SecurityContext c) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\Support\EndpointPayloads.cs:line 355
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.ExecuteAsync(MatrixRow row, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 77
   at ReviveHRSystem.SecurityTests.AccessMatrixTests.Row_Matches_Expected_Status(Int32 rowId, String identityKey) in D:\Youssef\Projects\_Hr System\ReviveHRSystem\Tests\ReviveHRSystem.SecurityTests\AccessMatrixTests.cs:line 61
--- End of stack trace from previous location ---
```
