import { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    buyer?: { id: number };
  }
}

function base64urlDecode(input: string): string {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  return Buffer.from(input, 'base64').toString('utf8');
}

export function requireBuyerAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }
  const token = auth.split(' ')[1] as string;
  const parts = token.split('.') as string[];
  if (parts.length < 2) {
    return res.status(403).json({ message: 'Invalid token' });
  }
  try {
    const payloadJson = base64urlDecode(parts[1] as string);
    const payload = JSON.parse(payloadJson);
    const id = Number(payload.id || payload.userId || payload.user_id);
    if (!id || Number.isNaN(id)) {
      return res.status(403).json({ message: 'Invalid token payload' });
    }
    req.buyer = { id };
    return next();
  } catch (e) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

