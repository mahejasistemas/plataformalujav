import * as React from "react";

type Props = {
  userName: string;
  verificationUrl: string;
  expiresMinutes?: number;
  brandName?: string;
  supportEmail?: string;
};

const PRIMARY = "#b91c1c";

export const ConfirmationEmail: React.FC<Props> = ({
  userName,
  verificationUrl,
  expiresMinutes = 60,
  brandName = "Plataforma Lujav",
  supportEmail = "soporte@transporteslujav.com",
}) => {
  const href = verificationUrl;
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <title>Confirma tu correo - {brandName}</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#f9fafb",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          color: "#111827",
        }}
      >
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ backgroundColor: "#f9fafb" }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  style={{ maxWidth: 520 }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          background: `linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)`,
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                          padding: "28px 32px",
                          color: "#fff",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            letterSpacing: 0.2,
                          }}
                        >
                          {brandName}
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style={{
                          backgroundColor: "#ffffff",
                          padding: "32px",
                          borderLeft: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                        }}
                      >
                        <h1
                          style={{
                            margin: "0 0 8px",
                            fontSize: 22,
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          Bienvenido, {userName}!
                        </h1>
                        <p
                          style={{
                            margin: "0 0 20px",
                            fontSize: 15,
                            lineHeight: 1.5,
                            color: "#4b5563",
                          }}
                        >
                          Gracias por registrarte. Haz clic en el botón de abajo
                          para confirmar tu dirección de correo y activar tu
                          cuenta.
                        </p>

                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                          style={{ margin: "8px 0 24px" }}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  borderRadius: 10,
                                  background: PRIMARY,
                                }}
                              >
                                <a
                                  href={href}
                                  style={{
                                    display: "inline-block",
                                    padding: "14px 24px",
                                    color: "#fff",
                                    fontWeight: 600,
                                    fontSize: 15,
                                    textDecoration: "none",
                                    borderRadius: 10,
                                  }}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Confirmar mi correo
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p
                          style={{
                            margin: "0 0 12px",
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#6b7280",
                            wordBreak: "break-all",
                          }}
                        >
                          O copia y pega este enlace en tu navegador:
                          <br />
                          <a
                            href={href}
                            style={{ color: PRIMARY, textDecoration: "underline" }}
                          >
                            {href}
                          </a>
                        </p>

                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: "#9ca3af",
                            lineHeight: 1.5,
                          }}
                        >
                          Este enlace expira en {expiresMinutes} minutos. Si no
                          solicitaste esta acción, puedes ignorar este correo.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td
                        style={{
                          backgroundColor: "#ffffff",
                          padding: "0 32px 28px",
                          borderLeft: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          borderBottom: "1px solid #f3f4f6",
                          borderBottomLeftRadius: 12,
                          borderBottomRightRadius: 12,
                          fontSize: 12,
                          color: "#9ca3af",
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ marginBottom: 4 }}>
                          &copy; {new Date().getFullYear()} {brandName}. Todos los
                          derechos reservados.
                        </div>
                        <div>
                          Contacto:{" "}
                          <a
                            href={`mailto:${supportEmail}`}
                            style={{ color: PRIMARY, textDecoration: "none" }}
                          >
                            {supportEmail}
                          </a>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
};

export default ConfirmationEmail;
