# Security Policy

## Reporting Security Vulnerabilities

At **id-verifier**, we take security seriously and appreciate your help in keeping our project safe. If you discover a security vulnerability, please follow our responsible disclosure process.

### How to Report

**Please do not open public GitHub issues for security vulnerabilities.**

Instead, email us at: **deveramarkron76@gmail.com**

Include the following information in your report:

- **Description**: A clear and concise description of the vulnerability
- **Impact**: What could be affected by this vulnerability?
- **Steps to Reproduce**: Detailed steps to reproduce the issue (if applicable)
- **Proof of Concept**: Any code, screenshots, or examples demonstrating the vulnerability
- **Affected Component**: Which part of the application is affected (frontend, backend, dependencies, etc.)
- **Your Contact Information**: Your name, email, and preferred communication method

### Response Timeline

We aim to respond to security reports within **48 hours** with:

- Acknowledgment of receipt
- Initial assessment of the vulnerability
- Timeline for a fix or patch

### What to Expect

1. We will investigate the reported vulnerability
2. We will work on a fix and prepare a security patch
3. We will notify you once the fix is ready for release
4. We will credit you in the security advisory (unless you prefer to remain anonymous)

### Scope

Our security policy covers:

- **In Scope**: Security vulnerabilities in this repository, including:
  - Authentication and authorization flaws
  - Data exposure or leaks
  - SQL injection or code injection vulnerabilities
  - Cross-site scripting (XSS)
  - Cross-site request forgery (CSRF)
  - Server-side request forgery (SSRF)
  - Dependency vulnerabilities
  - Other security issues that could impact confidentiality, integrity, or availability

- **Out of Scope**:
  - Denial of service (DoS) attacks
  - Social engineering
  - Physical security concerns
  - Self-XSS or issues requiring user interaction with malicious content
  - Issues in third-party services or dependencies (report directly to maintainers)

## Security Best Practices

### For Users

- Keep your environment variables (`.env.local`) secure and never commit them
- Use strong, unique passwords for your Supabase account
- Enable two-factor authentication on your Supabase and Vercel accounts
- Regularly review access permissions and remove unused admin accounts
- Keep the application updated to the latest version

### For Developers

- Do not commit secrets, API keys, or sensitive data to the repository
- Use `.env.local` (excluded via `.gitignore`) for local configuration
- Follow the security guidelines in the README.md
- Keep dependencies up to date by running `npm audit` regularly
- Use Supabase RLS policies to enforce access control
- Never expose the `SUPABASE_SERVICE_ROLE_KEY` in client-side code

## Dependency Management

We use the following tools to manage security:

- **npm audit**: Regularly run `npm audit` to identify known vulnerabilities
- **Dependabot**: Monitor dependencies for security updates (when enabled)
- **TypeScript**: Use strict typing to catch potential issues at compile-time

## Environment Variables

Sensitive configuration is managed through environment variables:

| Variable | Scope | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Public | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public | Supabase anonymous key (safe for client) |
| `VITE_APP_ORIGIN` | Public | Application origin for QR codes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Supabase service role (never in frontend) |

**Important**: The `SUPABASE_SERVICE_ROLE_KEY` should only be set in your Vercel deployment environment variables, never in `.env.local` or committed to the repository.

## Infrastructure Security

- **Hosting**: The application is deployed on Vercel with secure HTTPS connections
- **Database**: Supabase provides row-level security (RLS) policies for data protection
- **Authentication**: Supabase Auth handles secure user authentication
- **Access Control**: Admin privileges are controlled via the `public.users.is_admin` flag in the database

## Changelog

Security patches and updates will be documented in the [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) file and release notes.

## Additional Resources

- [Supabase Security Documentation](https://supabase.com/docs/guides/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE List](https://cwe.mitre.org/)

## Questions?

If you have any questions about this security policy, please contact the project maintainers.

---

**Last Updated**: June 2026
