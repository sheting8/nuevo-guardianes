export const ACCESS_TOKEN_EXPIRES_SECONDS = 15 * 60;
export const REFRESH_TOKEN_EXPIRES_DAYS = 7;

// Clientes sin cookie jar de navegador (apps móviles) se identifican con este
// header para recibir el refresh token en el body. Un request sin este header
// (cualquier navegador) nunca lo ve en el body, así que el modelo de
// seguridad de la cookie HttpOnly para web queda intacto.
export const MOBILE_CLIENT_HEADER = 'x-client-platform';
export const MOBILE_CLIENT_VALUE = 'mobile';
