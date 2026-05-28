import { Injectable } from '@nestjs/common';

/**
 * Bingo column ranges:
 * B: 1–15  (col 0)
 * I: 16–30 (col 1)
 * N: 31–45 (col 2)
 * G: 46–60 (col 3)
 * O: 61–75 (col 4)
 */
const COLUMN_RANGES = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
] as const;

export interface BingoGrid {
  numbers: (number | null)[][]; // null = free center square
}

@Injectable()
export class CardGeneratorService {
  /**
   * Generate a unique 5x5 Bingo card with standard BINGO column rules.
   * Center square (row 2, col 2) is free (null).
   */
  generateCard(): BingoGrid {
    const grid: (number | null)[][] = [];

    for (let col = 0; col < 5; col++) {
      const [min, max] = COLUMN_RANGES[col];
      const pool = this.shuffleArray(this.range(min, max));
      const selected = pool.slice(0, 5);
      // Build column
      for (let row = 0; row < 5; row++) {
        if (!grid[row]) grid[row] = [];
        grid[row][col] = selected[row];
      }
    }

    // Center free square
    grid[2][2] = null;

    return { numbers: grid };
  }

  /**
   * Generate the initial marked state (all false, center true)
   */
  generateInitialMarked(): boolean[][] {
    const marked: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(false));
    marked[2][2] = true; // Free center square
    return marked;
  }

  private range(min: number, max: number): number[] {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
