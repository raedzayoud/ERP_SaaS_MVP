import { StockMovement } from '../models/stock-movement';

export interface AvailabilityIssue {
  productId: string;
  required: number;
  available: number;
}

export function movementSignedQty(movement: StockMovement): number {
  return movement.direction === 'in' ? movement.quantity : -movement.quantity;
}

export function levelFor(
  movements: StockMovement[],
  warehouseId: string | undefined,
  productId: string,
): number {
  let total = 0;

  for (const movement of movements) {
    if (movement.productId !== productId) continue;
    if (warehouseId && movement.warehouseId !== warehouseId) continue;
    total += movementSignedQty(movement);
  }

  return total;
}

export function findAvailabilityIssues(
  movements: StockMovement[],
  warehouseId: string,
  requests: { productId: string; quantity: number }[],
): AvailabilityIssue[] {
  const needed = new Map<string, number>();
  for (const request of requests) {
    if (request.quantity <= 0) continue;
    needed.set(request.productId, (needed.get(request.productId) ?? 0) + request.quantity);
  }

  const issues: AvailabilityIssue[] = [];
  for (const [productId, required] of needed) {
    const available = levelFor(movements, warehouseId, productId);
    if (required > available) {
      issues.push({ productId, required, available });
    }
  }

  return issues;
}
