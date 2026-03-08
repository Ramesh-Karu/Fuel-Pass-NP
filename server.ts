import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import session from 'express-session';
import admin from 'firebase-admin';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'neon-emitter-469412-c5',
  });
}
const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(session({
    secret: 'fuel-pass-secret-123',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true 
    }
  }));

  // Passkey Registration Options
  app.get('/api/passkey/register-options', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const host = req.get('host') || '';
    const currentRpId = host.split(':')[0];
    const currentOrigin = `https://${currentRpId}`;

    // Find user
    const userSnapshot = await db.collection('users').where('username', '==', username).get();
    if (userSnapshot.empty) return res.status(404).json({ error: 'User not found' });

    const userDoc = userSnapshot.docs[0];

    // Get existing credentials
    const credentialsSnapshot = await db.collection('users').doc(userDoc.id).collection('passkeys').get();
    const excludeCredentials = credentialsSnapshot.docs.map(doc => ({
      id: Buffer.from(doc.data().credentialID, 'base64').toString('base64url'),
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: 'Fuel Pass System',
      rpID: currentRpId,
      userID: new Uint8Array(Buffer.from(userDoc.id)),
      userName: username as string,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Save challenge to session
    (req.session as any).currentChallenge = options.challenge;
    (req.session as any).registeringUser = userDoc.id;
    (req.session as any).currentRpId = currentRpId;
    (req.session as any).currentOrigin = currentOrigin;

    res.json(options);
  });

  // Passkey Registration Verification
  app.post('/api/passkey/register-verify', async (req, res) => {
    const { body } = req;
    const expectedChallenge = (req.session as any).currentChallenge;
    const userId = (req.session as any).registeringUser;
    const expectedRPID = (req.session as any).currentRpId;
    const expectedOrigin = (req.session as any).currentOrigin;

    if (!expectedChallenge || !userId || !expectedRPID || !expectedOrigin) {
      return res.status(400).json({ error: 'Registration session expired' });
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;

        // Store passkey in Firestore
        await db.collection('users').doc(userId).collection('passkeys').add({
          credentialID: Buffer.from(credential.id).toString('base64'),
          credentialPublicKey: Buffer.from(credential.publicKey).toString('base64'),
          counter: credential.counter,
          transports: body.response.transports,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ verified: true });
      } else {
        res.status(400).json({ error: 'Verification failed' });
      }
    } catch (error) {
      console.error('Registration verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      delete (req.session as any).currentChallenge;
      delete (req.session as any).registeringUser;
    }
  });

  // Passkey Login Options
  app.get('/api/passkey/login-options', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const host = req.get('host') || '';
    const currentRpId = host.split(':')[0];
    const currentOrigin = `https://${currentRpId}`;

    const userSnapshot = await db.collection('users').where('username', '==', username).get();
    if (userSnapshot.empty) return res.status(404).json({ error: 'User not found' });

    const userDoc = userSnapshot.docs[0];
    const credentialsSnapshot = await db.collection('users').doc(userDoc.id).collection('passkeys').get();
    
    const allowCredentials = credentialsSnapshot.docs.map(doc => ({
      id: Buffer.from(doc.data().credentialID, 'base64').toString('base64url'),
      type: 'public-key' as const,
      transports: doc.data().transports,
    }));

    const options = await generateAuthenticationOptions({
      rpID: currentRpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    (req.session as any).currentChallenge = options.challenge;
    (req.session as any).loggingInUser = userDoc.id;
    (req.session as any).currentRpId = currentRpId;
    (req.session as any).currentOrigin = currentOrigin;

    res.json(options);
  });

  // Passkey Login Verification
  app.post('/api/passkey/login-verify', async (req, res) => {
    const { body } = req;
    const expectedChallenge = (req.session as any).currentChallenge;
    const userId = (req.session as any).loggingInUser;
    const expectedRPID = (req.session as any).currentRpId;
    const expectedOrigin = (req.session as any).currentOrigin;

    if (!expectedChallenge || !userId || !expectedRPID || !expectedOrigin) {
      return res.status(400).json({ error: 'Login session expired' });
    }

    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      // Find the specific credential
      const credentialsSnapshot = await db.collection('users').doc(userId).collection('passkeys').get();
      const credentialDoc = credentialsSnapshot.docs.find(doc => doc.data().credentialID === body.id);

      if (!credentialDoc) {
        return res.status(400).json({ error: 'Credential not found' });
      }

      const credential = credentialDoc.data();

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        credential: {
          id: Buffer.from(credential.credentialID, 'base64').toString('base64url'),
          publicKey: Buffer.from(credential.credentialPublicKey, 'base64'),
          counter: credential.counter,
        },
      });

      if (verification.verified) {
        // Update counter
        await credentialDoc.ref.update({
          counter: verification.authenticationInfo.newCounter,
        });

        res.json({ verified: true, user: { id: userDoc.id, ...userData } });
      } else {
        res.status(400).json({ error: 'Verification failed' });
      }
    } catch (error) {
      console.error('Login verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      delete (req.session as any).currentChallenge;
      delete (req.session as any).loggingInUser;
    }
  });

  // Email sending endpoint
  app.post('/api/send-invoice', async (req, res) => {
    const { email, invoiceData } = req.body;
    
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Fuel Pumping Invoice - NP Fuel Pass',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #141414;">
            <h2 style="border-bottom: 2px solid #141414; padding-bottom: 10px;">Fuel Pumping Invoice</h2>
            <p>Thank you for using NP Fuel Pass. Here are your transaction details:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${invoiceData.date}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Time:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${invoiceData.time}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Station:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${invoiceData.station}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vehicle:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${invoiceData.vehicle}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${invoiceData.amount} L</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Remaining Quota:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${invoiceData.remaining} L</td></tr>
            </table>
            <p style="margin-top: 30px; font-size: 12px; opacity: 0.5;">This is an automated message, please do not reply.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
