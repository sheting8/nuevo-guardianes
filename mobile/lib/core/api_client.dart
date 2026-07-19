import 'dart:convert';

import 'package:http/http.dart' as http;

import 'token_store.dart';

/// Base URL of the Guardianes API. Override at build/run time with:
/// flutter run --dart-define=API_URL=http://10.0.2.2:4000
const _apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000');

/// Sent on every request so the API includes the refresh token in JSON
/// response bodies (mobile has no browser cookie jar to hold it). A request
/// without this header — i.e. any browser — never gets it in the body,
/// so web's HttpOnly-cookie security model is untouched by this.
const _mobileHeader = {'X-Client-Platform': 'mobile'};

class ApiException implements Exception {
  ApiException(this.message, this.statusCode);

  final String message;
  final int statusCode;

  @override
  String toString() => message;
}

/// Thin HTTP client mirroring web/lib/api.ts: attaches the bearer access
/// token, unwraps the `{ data }` response envelope, and retries once via
/// /auth/refresh on a 401 before giving up.
class ApiClient {
  ApiClient({http.Client? httpClient, TokenStore? tokenStore})
      : _http = httpClient ?? http.Client(),
        _tokens = tokenStore ?? TokenStore();

  final http.Client _http;
  final TokenStore _tokens;

  Future<dynamic> get(String path) => _requestWithRetry('GET', path);

  Future<dynamic> post(String path, {Object? body}) =>
      _requestWithRetry('POST', path, body: body);

  Future<dynamic> patch(String path, {Object? body}) =>
      _requestWithRetry('PATCH', path, body: body);

  Future<dynamic> delete(String path) => _requestWithRetry('DELETE', path);

  Future<dynamic> _requestWithRetry(String method, String path, {Object? body}) async {
    var accessToken = await _tokens.readAccessToken();
    var response = await _send(method, path, body: body, accessToken: accessToken);

    if (response.statusCode == 401) {
      final refreshedAccessToken = await _refresh();
      if (refreshedAccessToken == null) {
        await _tokens.clear();
        throw ApiException('Sesión expirada', 401);
      }
      response = await _send(method, path, body: body, accessToken: refreshedAccessToken);
    }

    return _unwrap(response);
  }

  Future<http.Response> _send(String method, String path, {Object? body, String? accessToken}) {
    final uri = Uri.parse('$_apiUrl$path');
    final headers = {
      'Content-Type': 'application/json',
      ..._mobileHeader,
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
    };
    final encodedBody = body != null ? jsonEncode(body) : null;

    switch (method) {
      case 'POST':
        return _http.post(uri, headers: headers, body: encodedBody);
      case 'PATCH':
        return _http.patch(uri, headers: headers, body: encodedBody);
      case 'DELETE':
        return _http.delete(uri, headers: headers);
      default:
        return _http.get(uri, headers: headers);
    }
  }

  /// Rotates the refresh token via POST /auth/refresh (sent in the body,
  /// since mobile has no session cookie) and persists both new tokens.
  /// Returns the new access token, or null if the refresh token is
  /// missing/invalid/expired.
  Future<String?> _refresh() async {
    final refreshToken = await _tokens.readRefreshToken();
    if (refreshToken == null) return null;

    final response = await _http.post(
      Uri.parse('$_apiUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json', ..._mobileHeader},
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    if (response.statusCode != 200) return null;

    final data = _unwrap(response) as Map<String, dynamic>;
    final newAccessToken = data['accessToken'] as String?;
    final newRefreshToken = data['refreshToken'] as String?;
    if (newAccessToken == null || newRefreshToken == null) return null;

    await _tokens.writeAccessToken(newAccessToken);
    await _tokens.writeRefreshToken(newRefreshToken);
    return newAccessToken;
  }

  dynamic _unwrap(http.Response response) {
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);

    if (response.statusCode >= 400) {
      final message = decoded is Map && decoded['message'] != null
          ? (decoded['message'] is List ? decoded['message'][0] : decoded['message'])
          : 'Ocurrió un error inesperado';
      throw ApiException(message as String, response.statusCode);
    }

    return decoded is Map && decoded.containsKey('data') ? decoded['data'] : decoded;
  }
}
