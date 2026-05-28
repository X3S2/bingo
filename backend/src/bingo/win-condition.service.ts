import { Injectable } from '@nestjs/common';

export interface WinResult {
  hasWon: boolean;
  winningLines: Array<{ type: 'row' | 'col' | 'diag'; index: number }>;
}

@Injectable()
export class WinConditionService {
  /**
   * Check if a 5×5 marked grid has a winning line.
   * A win is: full row, full column, or either diagonal (all 5 cells marked).
   */
  checkWin(marked: boolean[][]): WinResult {
    const winningLines: WinResult['winningLines'] = [];

    // Check rows
    for (let row = 0; row < 5; row++) {
      if (marked[row].every((cell) => cell === true)) {
        winningLines.push({ type: 'row', index: row });
      }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      if (marked.every((row) => row[col] === true)) {
        winningLines.push({ type: 'col', index: col });
      }
    }

    // Check main diagonal (top-left → bottom-right)
    if (marked.every((row, i) => row[i] === true)) {
      winningLines.push({ type: 'diag', index: 0 });
    }

    // Check anti-diagonal (top-right → bottom-left)
    if (marked.every((row, i) => row[4 - i] === true)) {
      winningLines.push({ type: 'diag', index: 1 });
    }

    return { hasWon: winningLines.length > 0, winningLines };
  }

  /**
   * Calculate "Bingo proximity" – minimum numbers needed to complete any line.
   * Lower = closer to winning.
   */
  calculateProximity(marked: boolean[][]): number {
    let minRemaining = 5;

    // Rows
    for (let row = 0; row < 5; row++) {
      const remaining = marked[row].filter((c) => !c).length;
      minRemaining = Math.min(minRemaining, remaining);
    }

    // Columns
    for (let col = 0; col < 5; col++) {
      const remaining = marked.filter((row) => !row[col]).length;
      minRemaining = Math.min(minRemaining, remaining);
    }

    // Main diagonal
    const diagMain = [0, 1, 2, 3, 4].filter((i) => !marked[i][i]).length;
    minRemaining = Math.min(minRemaining, diagMain);

    // Anti-diagonal
    const diagAnti = [0, 1, 2, 3, 4].filter((i) => !marked[i][4 - i]).length;
    minRemaining = Math.min(minRemaining, diagAnti);

    return minRemaining;
  }

  /**
   * Apply a drawn number to a card's marked state.
   * Returns updated marked grid and whether a cell was newly marked.
   */
  applyNumber(
    grid: (number | null)[][],
    marked: boolean[][],
    drawnNumber: number,
  ): { updated: boolean[][]; cellMarked: boolean } {
    const updated = marked.map((row) => [...row]);
    let cellMarked = false;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (grid[row][col] === drawnNumber && !updated[row][col]) {
          updated[row][col] = true;
          cellMarked = true;
        }
      }
    }

    return { updated, cellMarked };
  }
}
