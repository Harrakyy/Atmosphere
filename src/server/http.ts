import { ZodError } from "zod";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 422,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class SlotTakenError extends AppError {
  constructor(message = "Slot waktu pada ruangan tersebut baru saja dipesan orang lain.") {
    super("SLOT_TAKEN", message, 409);
  }
}

export class TimeRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super("TIME_RULE", message, 422, details);
  }
}

export class CartRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CART_RULE", message, 422, details);
  }
}

export class RoomUnavailableError extends AppError {
  constructor(message: string, details?: unknown) {
    super("ROOM_UNAVAILABLE", message, 422, details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string) {
    super("INVALID_TRANSITION", message, 422);
  }
}

export class PaymentGatewayError extends AppError {
  constructor(message = "Gagal menghubungi payment gateway.") {
    super("PAYMENT_GATEWAY_ERROR", message, 502);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan.") {
    super("NOT_FOUND", message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Akses ditolak. Silakan login terlebih dahulu.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export function ok<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return Response.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status }
  );
}

export function handleError(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.statusCode, error.details);
  }

  if (error instanceof ZodError) {
    return fail(
      "VALIDATION_ERROR",
      error.issues[0]?.message || "Validasi gagal",
      400,
      error.format()
    );
  }

  console.error("Unhandled error:", error);
  return fail("INTERNAL", "Terjadi kesalahan pada server.", 500);
}
