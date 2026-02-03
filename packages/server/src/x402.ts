/**
 * x402 Payment Verification
 * 
 * Integrates with x402 facilitator for payment verification and settlement
 */

import { Request, Response, NextFunction } from 'express';

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  description: string;
  resource: string;
}

export interface FacilitatorConfig {
  url: string;
  apiKey?: string;
}

const DEFAULT_FACILITATOR = 'https://x402.org/facilitator';

/**
 * Verify payment with x402 facilitator
 */
export async function verifyPayment(
  paymentSignature: string,
  requirement: PaymentRequirement,
  facilitatorConfig: FacilitatorConfig = { url: DEFAULT_FACILITATOR }
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${facilitatorConfig.url}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(facilitatorConfig.apiKey && { 'Authorization': `Bearer ${facilitatorConfig.apiKey}` }),
      },
      body: JSON.stringify({
        paymentSignature,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { valid: false, error: `Facilitator error: ${error}` };
    }

    const result = await response.json() as { valid?: boolean; error?: string };
    return { valid: result.valid === true, error: result.error };
  } catch (error) {
    console.error('[x402] Verification failed:', error);
    return { valid: false, error: (error as Error).message };
  }
}

/**
 * Settle payment with x402 facilitator
 */
export async function settlePayment(
  paymentSignature: string,
  requirement: PaymentRequirement,
  facilitatorConfig: FacilitatorConfig = { url: DEFAULT_FACILITATOR }
): Promise<{ settled: boolean; txHash?: string; error?: string }> {
  try {
    const response = await fetch(`${facilitatorConfig.url}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(facilitatorConfig.apiKey && { 'Authorization': `Bearer ${facilitatorConfig.apiKey}` }),
      },
      body: JSON.stringify({
        paymentSignature,
        paymentRequirements: requirement,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { settled: false, error: `Settlement error: ${error}` };
    }

    const result = await response.json() as { settled?: boolean; transactionHash?: string; error?: string };
    return { 
      settled: result.settled === true, 
      txHash: result.transactionHash,
      error: result.error,
    };
  } catch (error) {
    console.error('[x402] Settlement failed:', error);
    return { settled: false, error: (error as Error).message };
  }
}

interface RouteConfig {
  price: string;
  description: string;
}

/**
 * Create x402 payment middleware
 */
export function createPaymentMiddleware(config: {
  routes: Record<string, RouteConfig>;
  walletAddress: string;
  network: string;
  facilitatorUrl?: string;
  facilitatorApiKey?: string;
  devMode?: boolean;
}) {
  const facilitatorConfig: FacilitatorConfig = {
    url: config.facilitatorUrl || DEFAULT_FACILITATOR,
    apiKey: config.facilitatorApiKey,
  };

  return (routeKey: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const paymentSignature = req.headers['payment-signature'] as string;
      const routeConfig = config.routes[routeKey];

      // Dev mode bypass
      if (config.devMode && !paymentSignature) {
        console.log(`[x402:DEV] Bypassing payment for ${routeKey}`);
        return next();
      }

      // No payment provided - return 402
      if (!paymentSignature) {
        const requirement: PaymentRequirement = {
          scheme: 'exact',
          network: config.network,
          maxAmountRequired: routeConfig?.price.replace('$', '') || '0.001',
          asset: 'USDC',
          payTo: config.walletAddress,
          description: routeConfig?.description || 'Memory operation',
          resource: req.originalUrl,
        };

        res.setHeader('X-Payment-Required', Buffer.from(JSON.stringify(requirement)).toString('base64'));
        
        return res.status(402).json({
          error: 'Payment Required',
          'x-payment-required': requirement,
        });
      }

      // Verify payment with facilitator
      const requirement: PaymentRequirement = {
        scheme: 'exact',
        network: config.network,
        maxAmountRequired: routeConfig?.price.replace('$', '') || '0.001',
        asset: 'USDC',
        payTo: config.walletAddress,
        description: routeConfig?.description || 'Memory operation',
        resource: req.originalUrl,
      };

      // In production, verify with facilitator
      if (!config.devMode) {
        const verification = await verifyPayment(paymentSignature, requirement, facilitatorConfig);
        
        if (!verification.valid) {
          console.log(`[x402] Payment verification failed: ${verification.error}`);
          return res.status(402).json({
            error: 'Payment verification failed',
            details: verification.error,
            'x-payment-required': requirement,
          });
        }

        // Settle the payment
        const settlement = await settlePayment(paymentSignature, requirement, facilitatorConfig);
        
        if (!settlement.settled) {
          console.log(`[x402] Payment settlement failed: ${settlement.error}`);
          return res.status(402).json({
            error: 'Payment settlement failed',
            details: settlement.error,
          });
        }

        // Add settlement info to response headers
        res.setHeader('X-Payment-Response', Buffer.from(JSON.stringify({
          settled: true,
          txHash: settlement.txHash,
        })).toString('base64'));

        console.log(`[x402] Payment settled: ${settlement.txHash}`);
      } else {
        // Dev mode with payment header - just accept it
        console.log(`[x402:DEV] Payment accepted for ${routeKey}`);
      }

      next();
    };
  };
}
