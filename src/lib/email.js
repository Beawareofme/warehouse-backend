export async function sendEmail({ to, subject, text }) {
  console.log('📧 [DEV EMAIL]', { to, subject, text });
  return true;
}
