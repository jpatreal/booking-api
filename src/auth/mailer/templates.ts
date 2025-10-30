export function renderVerifyEmailTemplate({ link }: { link: string }) {
  return `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Verify your email</h2>
      <p>Click the button below to verify your email address.</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #ddd">Verify Email</a></p>
      <p>If the button doesn’t work, copy and paste this URL:</p>
      <code>${link}</code>
    </div>
  `;
}

export function renderResetPasswordTemplate({ link }: { link: string }) {
  return `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Reset your password</h2>
      <p>We received a request to reset your password. If this wasn’t you, ignore this email.</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #ddd">Reset Password</a></p>
      <p>Link (valid for 30 minutes):</p>
      <code>${link}</code>
    </div>
  `;
}
