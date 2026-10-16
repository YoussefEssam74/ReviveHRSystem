using Microsoft.AspNetCore.Mvc;
using ServiceAbstraction.Services;
using Shared.DataTransferObject.EmployeeProfile;

namespace Presentation.Controllers
{
    /// <summary>Account settings for the signed-in user (mock §12).</summary>
    [Route("api/me/settings")]
    public class AccountSettingsController(IAccountSettingsService settingsService) : ApiControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<NotificationPreferenceDto>> GetPreferences(CancellationToken cancellationToken)
        {
            var preferences = await settingsService.GetPreferencesAsync(GetActorUserId(), cancellationToken);
            return Ok(preferences);
        }

        [HttpPut]
        public async Task<ActionResult<NotificationPreferenceDto>> UpdatePreferences(
            NotificationPreferenceDto preferences, CancellationToken cancellationToken)
        {
            var updated = await settingsService.UpdatePreferencesAsync(GetActorUserId(), preferences, cancellationToken);
            return Ok(updated);
        }
    }

    /// <summary>Self-service password change (mock openChangePassword).</summary>
    [Route("api/auth/change-password")]
    public class ChangePasswordController(IAccountSettingsService settingsService) : ApiControllerBase
    {
        [HttpPost]
        public async Task<IActionResult> ChangePassword(
            ChangePasswordRequestDto request, CancellationToken cancellationToken)
        {
            await settingsService.ChangePasswordAsync(GetActorUserId(), request, cancellationToken);
            return NoContent();
        }
    }
}
