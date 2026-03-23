import { describe, it, expect } from "vitest";
import {
  ChiefStakerError,
  parseChiefStakerError,
  extractProgramError,
} from "../src/index.js";

describe("parseChiefStakerError", () => {
  it("parses all known error codes", () => {
    for (let code = 6000; code <= 6034; code++) {
      const result = parseChiefStakerError(code);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(code);
      expect(result!.name.length).toBeGreaterThan(0);
      expect(result!.message.length).toBeGreaterThan(0);
    }
  });

  it("returns null for unknown error codes", () => {
    expect(parseChiefStakerError(5999)).toBeNull();
    expect(parseChiefStakerError(6035)).toBeNull();
    expect(parseChiefStakerError(0)).toBeNull();
    expect(parseChiefStakerError(9999)).toBeNull();
  });

  it("maps specific codes to correct names", () => {
    expect(parseChiefStakerError(6000)!.name).toBe("InvalidInstruction");
    expect(parseChiefStakerError(6010)!.name).toBe("InsufficientStakeBalance");
    expect(parseChiefStakerError(6022)!.name).toBe("StakeLocked");
    expect(parseChiefStakerError(6024)!.name).toBe("CooldownRequired");
    expect(parseChiefStakerError(6034)!.name).toBe("RewardDebtExceedsBound");
  });

  it("maps specific codes to correct messages", () => {
    expect(parseChiefStakerError(6014)!.message).toBe(
      "Zero amount not allowed"
    );
    expect(parseChiefStakerError(6027)!.message).toBe(
      "Authority has been renounced"
    );
  });
});

describe("extractProgramError", () => {
  it("extracts error from logs array", () => {
    const error = {
      logs: [
        "Program 3Ecf8gyRURyrBtGHS1XAVXyQik5PqgDch4VkxrH4ECcr invoke [1]",
        "Program log: custom program error: 0x1776",
        "Program 3Ecf8gyRURyrBtGHS1XAVXyQik5PqgDch4VkxrH4ECcr consumed 5000 of 200000 compute units",
      ],
    };

    const result = extractProgramError(error);
    expect(result).not.toBeNull();
    // 0x1776 = 6006
    expect(result!.code).toBe(ChiefStakerError.InvalidAuthority);
    expect(result!.name).toBe("InvalidAuthority");
  });

  it("extracts error from message string", () => {
    const error = {
      message:
        "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1772",
    };

    const result = extractProgramError(error);
    expect(result).not.toBeNull();
    // 0x1772 = 6002
    expect(result!.code).toBe(ChiefStakerError.NotInitialized);
  });

  it("prefers logs over message", () => {
    const error = {
      message: "custom program error: 0x1770", // 6000
      logs: ["custom program error: 0x1776"], // 6006
    };

    const result = extractProgramError(error);
    expect(result).not.toBeNull();
    expect(result!.code).toBe(ChiefStakerError.InvalidAuthority); // from logs
  });

  it("returns null for non-ChiefStaker errors", () => {
    const error = {
      logs: ["custom program error: 0x0001"], // code 1, not a ChiefStaker error
    };

    expect(extractProgramError(error)).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(extractProgramError(null)).toBeNull();
    expect(extractProgramError(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractProgramError("string")).toBeNull();
    expect(extractProgramError(42)).toBeNull();
  });

  it("returns null when no error pattern in logs or message", () => {
    const error = {
      message: "some other error",
      logs: ["Program log: something happened"],
    };

    expect(extractProgramError(error)).toBeNull();
  });

  it("handles hex codes for all error boundaries", () => {
    // 6000 = 0x1770
    const first = extractProgramError({
      message: "custom program error: 0x1770",
    });
    expect(first!.code).toBe(ChiefStakerError.InvalidInstruction);

    // 6034 = 0x1792
    const last = extractProgramError({
      message: "custom program error: 0x1792",
    });
    expect(last!.code).toBe(ChiefStakerError.RewardDebtExceedsBound);
  });

  it("handles uppercase hex", () => {
    const result = extractProgramError({
      message: "custom program error: 0x1776",
    });
    expect(result).not.toBeNull();

    const resultUpper = extractProgramError({
      message: "custom program error: 0x1776",
    });
    expect(resultUpper!.code).toBe(result!.code);
  });
});

describe("ChiefStakerError enum", () => {
  it("has correct numeric values", () => {
    expect(ChiefStakerError.InvalidInstruction).toBe(6000);
    expect(ChiefStakerError.ZeroAmount).toBe(6014);
    expect(ChiefStakerError.CooldownRequired).toBe(6024);
    expect(ChiefStakerError.RewardDebtExceedsBound).toBe(6034);
  });

  it("supports reverse lookup", () => {
    expect(ChiefStakerError[6000]).toBe("InvalidInstruction");
    expect(ChiefStakerError[6022]).toBe("StakeLocked");
  });
});
