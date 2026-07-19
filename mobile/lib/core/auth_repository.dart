import 'api_client.dart';
import 'token_store.dart';

class Usuario {
  Usuario({required this.id, required this.nombre, required this.roles});

  factory Usuario.fromJson(Map<String, dynamic> json) => Usuario(
        id: json['id'] as String,
        nombre: json['nombre'] as String,
        roles: (json['roles'] as List).cast<String>(),
      );

  final String id;
  final String nombre;
  final List<String> roles;
}

/// Handles login/logout against the mobile auth contract (see
/// api/src/auth/auth.controller.ts): both tokens arrive in the response body
/// because the API detects the `X-Client-Platform: mobile` header ApiClient
/// sends on every request, instead of the HttpOnly cookie it gives browsers.
class AuthRepository {
  AuthRepository({ApiClient? apiClient, TokenStore? tokenStore})
      : _api = apiClient ?? ApiClient(),
        _tokens = tokenStore ?? TokenStore();

  final ApiClient _api;
  final TokenStore _tokens;

  Future<Usuario> login(String username, String password) async {
    final data = await _api.post('/auth/login', body: {
      'username': username,
      'password': password,
    }) as Map<String, dynamic>;

    await _tokens.writeAccessToken(data['accessToken'] as String);
    await _tokens.writeRefreshToken(data['refreshToken'] as String);
    return Usuario.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    final refreshToken = await _tokens.readRefreshToken();
    try {
      await _api.post('/auth/logout', body: {'refreshToken': refreshToken});
    } finally {
      await _tokens.clear();
    }
  }

  Future<bool> estaAutenticado() async => await _tokens.readAccessToken() != null;
}
