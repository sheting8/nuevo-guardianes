import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the access/refresh tokens in the platform keystore/keychain.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> writeAccessToken(String token) => _storage.write(key: _accessTokenKey, value: token);

  Future<void> writeRefreshToken(String token) => _storage.write(key: _refreshTokenKey, value: token);

  Future<void> clear() => _storage.deleteAll();
}
