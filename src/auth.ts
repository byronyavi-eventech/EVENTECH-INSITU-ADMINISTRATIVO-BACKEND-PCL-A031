import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { Resend } from 'resend';
import * as dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY!);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      try {
        const result = await resend.emails.send({
          from: process.env.EMAIL_SENDER as string,
          to: user.email,
          subject: 'Verificar tu correo electrónico - Insitu',
          html: `<p>Hola ${user.name},</p><p>Por favor, haz clic <a href="${url}">aquí</a> para verificar tu dirección de correo electrónico.</p>`,
        });
        console.log('Resend send email result:', result);
      } catch (error) {
        console.error('Error sending verification email via Resend:', error);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: ['http://localhost:5173'],
});
