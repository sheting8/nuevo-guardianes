import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'notificaciones_repository.dart';

/// Attached to `MaterialApp.scaffoldMessengerKey` in main.dart so
/// [PushService] can surface a foreground push as a SnackBar without needing
/// a BuildContext of its own.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Wires up Firebase Cloud Messaging: requests notification permission,
/// obtains the FCM token and registers it with the API
/// (`POST /notificaciones/dispositivos`), and shows a SnackBar for
/// foreground messages.
///
/// There is no real Firebase project configured yet — no
/// google-services.json / GoogleService-Info.plist is committed to this repo
/// — so `Firebase.initializeApp()` is expected to throw until those are
/// added. [inicializar] swallows any failure so the rest of the app (login,
/// checklists, inventory) keeps working with push entirely absent, exactly
/// like the backend's `FcmService` degrades gracefully with no credentials
/// configured.
class PushService {
  PushService({NotificacionesRepository? repository})
      : _repo = repository ?? NotificacionesRepository();

  /// Shared instance: the login screen calls [inicializar] (which registers
  /// the device token), and [HomeShell]'s logout needs that same in-memory
  /// token to deregister it, so both must talk to one instance.
  static final PushService instance = PushService();

  final NotificacionesRepository _repo;

  String? _token;

  /// The last FCM token obtained, if any (null if push was never
  /// initialized or initialization failed — e.g. no Firebase project yet).
  String? get token => _token;

  Future<void> inicializar() async {
    try {
      await Firebase.initializeApp();

      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('PushService: permiso de notificaciones denegado por el usuario');
        return;
      }

      final fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken == null) {
        debugPrint('PushService: no se pudo obtener el token de FCM');
        return;
      }
      _token = fcmToken;

      final plataforma = Platform.isAndroid
          ? 'ANDROID'
          : Platform.isIOS
              ? 'IOS'
              : 'WEB';
      await _repo.registrarDispositivo(fcmToken, plataforma);

      FirebaseMessaging.onMessage.listen(_mostrarBanner);
    } catch (e) {
      // Expected in every environment until a real google-services.json /
      // GoogleService-Info.plist is added — push is a nice-to-have, never a
      // hard dependency for the rest of the app.
      debugPrint('PushService: no se pudo inicializar push (¿falta configurar Firebase?): $e');
    }
  }

  void _mostrarBanner(RemoteMessage message) {
    final titulo = message.notification?.title ?? message.data['titulo'] as String?;
    final cuerpo = message.notification?.body ?? message.data['cuerpo'] as String?;
    final texto = [titulo, cuerpo].whereType<String>().join(': ');
    if (texto.isEmpty) return;
    scaffoldMessengerKey.currentState?.showSnackBar(SnackBar(content: Text(texto)));
  }

  /// Best-effort deregistration of the last known FCM token on logout.
  /// Never throws — logout must succeed regardless of push state.
  Future<void> eliminarDispositivoActual() async {
    final currentToken = _token;
    if (currentToken == null) return;
    try {
      await _repo.eliminarDispositivo(currentToken);
    } catch (e) {
      debugPrint('PushService: no se pudo eliminar el dispositivo al cerrar sesión: $e');
    } finally {
      _token = null;
    }
  }
}
