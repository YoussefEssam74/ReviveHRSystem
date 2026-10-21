using DomainLayer.Exceptions;
using DomainLayer.Models.UserModule.Enums;
using Microsoft.Extensions.DependencyInjection;
using ReviveHRSystem.IntegrationTests.Fixtures;
using ReviveHRSystem.IntegrationTests.Support;
using ServiceAbstraction.Services;
using Xunit;

namespace ReviveHRSystem.IntegrationTests
{
    /// <summary>
    /// Exercises the central ADR-003 authorization guard directly: permission keys,
    /// gym scope, Top Management bypass, and inactive-session rejection.
    /// </summary>
    [Collection(ApiTestFixture.CollectionName)]
    public class AccessControlServiceTests
    {
        private readonly ApiTestFixture _fixture;

        public AccessControlServiceTests(ApiTestFixture fixture) => _fixture = fixture;

        [Fact]
        public async Task EnsurePermission_MissingGrant_Returns401()
        {
            using var scope = _fixture.Services.CreateScope();
            var guard = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
            var builder = new TestDataBuilder(scope.ServiceProvider);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new List<TestGym> { gym });

            var ex = await Assert.ThrowsAsync<UnAuthorizedException>(() =>
                guard.EnsurePermissionAsync(user.UserId, "employees.manage"));

            Assert.Equal("You do not have permission to perform this action.", ex.Message);
        }

        [Fact]
        public async Task EnsurePermission_DirectGrant_Passes()
        {
            using var scope = _fixture.Services.CreateScope();
            var guard = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
            var builder = new TestDataBuilder(scope.ServiceProvider);
            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new List<TestGym> { gym });

            await builder.GrantPermissionAsync(user.UserId, "employees.manage");

            // Granted directly (no role involved) — must pass without throwing.
            await guard.EnsurePermissionAsync(user.UserId, "employees.manage");
        }

        [Fact]
        public async Task EnsurePermission_TopManagement_BypassesWithoutGrants()
        {
            using var scope = _fixture.Services.CreateScope();
            var guard = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
            var builder = new TestDataBuilder(scope.ServiceProvider);
            var admin = await builder.CreateUserAsync(UserType.TopManagement, Array.Empty<TestGym>());

            // Top Management holds no seeded grants; the bypass is what makes this pass.
            await guard.EnsurePermissionAsync(admin.UserId, "no.such.permission.key");
        }

        [Fact]
        public async Task EnsurePermission_NullOrInactiveActor_Returns401()
        {
            using var scope = _fixture.Services.CreateScope();
            var guard = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
            var builder = new TestDataBuilder(scope.ServiceProvider);

            var nullActor = await Assert.ThrowsAsync<UnAuthorizedException>(() =>
                guard.EnsurePermissionAsync(null, "employees.manage"));
            Assert.Equal("Your session is invalid. Please sign in again.", nullActor.Message);

            var gym = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new List<TestGym> { gym });
            await builder.SetUserActiveAsync(user.UserId, isActive: false);

            var inactive = await Assert.ThrowsAsync<UnAuthorizedException>(() =>
                guard.EnsurePermissionAsync(user.UserId, "employees.manage"));
            Assert.Equal("Your session is invalid. Please sign in again.", inactive.Message);
        }

        [Fact]
        public async Task EnsureGymAccess_AssignedGym_Passes_OtherGym_Returns401()
        {
            using var scope = _fixture.Services.CreateScope();
            var guard = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
            var builder = new TestDataBuilder(scope.ServiceProvider);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new List<TestGym> { gymA });

            await guard.EnsureGymAccessAsync(user.UserId, gymA.GymId);

            var ex = await Assert.ThrowsAsync<UnAuthorizedException>(() =>
                guard.EnsureGymAccessAsync(user.UserId, gymB.GymId));
            Assert.Equal("You do not have access to this gym.", ex.Message);
        }

        [Fact]
        public async Task EnsurePermissionForGym_RequiresBothGrantAndGymAccess()
        {
            using var scope = _fixture.Services.CreateScope();
            var guard = scope.ServiceProvider.GetRequiredService<IAccessControlService>();
            var builder = new TestDataBuilder(scope.ServiceProvider);
            var gymA = await builder.CreateGymWithStationAsync();
            var gymB = await builder.CreateGymWithStationAsync();
            var user = await builder.CreateUserAsync(UserType.Employee, new List<TestGym> { gymA });
            await builder.GrantPermissionAsync(user.UserId, "schedules.manage");

            // Grant + right gym: passes.
            await guard.EnsurePermissionForGymAsync(user.UserId, "schedules.manage", gymA.GymId);

            // Grant but wrong gym: gym-scope half rejects.
            var wrongGym = await Assert.ThrowsAsync<UnAuthorizedException>(() =>
                guard.EnsurePermissionForGymAsync(user.UserId, "schedules.manage", gymB.GymId));
            Assert.Equal("You do not have access to this gym.", wrongGym.Message);

            // Right gym but missing grant: permission half rejects.
            var missingGrant = await Assert.ThrowsAsync<UnAuthorizedException>(() =>
                guard.EnsurePermissionForGymAsync(user.UserId, "employees.manage", gymA.GymId));
            Assert.Equal("You do not have permission to perform this action.", missingGrant.Message);
        }
    }
}
