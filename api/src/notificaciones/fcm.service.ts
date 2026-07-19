import { Injectable, Logger } from '@nestjs/common';
import { type App, cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * Envío de push vía Firebase Cloud Messaging. Si no hay credencial
 * configurada (FIREBASE_SERVICE_ACCOUNT_JSON), este servicio queda inerte:
 * cada envío es un no-op silencioso (con un warning al arrancar) en vez de
 * romper el resto de la app — el registro en Notificacion siempre se crea
 * independientemente de si el push realmente se pudo enviar.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: App | null = null;

  constructor() {
    const credencialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!credencialJson) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON no configurado — las notificaciones push quedan deshabilitadas (los registros de Notificacion se siguen creando normalmente).',
      );
      return;
    }

    try {
      const credencial = JSON.parse(credencialJson) as ServiceAccount;
      this.app = initializeApp({ credential: cert(credencial) });
    } catch (error) {
      this.logger.error(
        'No se pudo inicializar Firebase Admin con FIREBASE_SERVICE_ACCOUNT_JSON',
        error as Error,
      );
    }
  }

  async enviarATokens(
    tokens: string[],
    titulo: string,
    cuerpo: string,
    datos?: Record<string, string>,
  ): Promise<void> {
    if (!this.app || tokens.length === 0) return;

    try {
      const respuesta = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification: { title: titulo, body: cuerpo },
        data: datos,
      });
      respuesta.responses.forEach((r, i) => {
        if (!r.success) {
          this.logger.warn(
            `Push falló para un token registrado (${tokens[i].slice(0, 12)}…): ${r.error?.message}`,
          );
        }
      });
    } catch (error) {
      this.logger.error('Error enviando notificación push', error as Error);
    }
  }
}
