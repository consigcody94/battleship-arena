/**
 * Gemini CLI adapter for Battleship
 */

import { spawn } from 'child_process';
import { AIPlayer } from './AIPlayer.js';
import { PlayerType } from '../game/types.js';

export class GeminiPlayer extends AIPlayer {
  type: PlayerType = 'gemini';
  name = 'Gemini';
  private model: string;
  private timeout: number;

  constructor(options: { model?: string; timeout?: number } = {}) {
    super();
    this.model = options.model || 'gemini-2.5-pro';
    this.timeout = options.timeout || 60000;
    this.name = `Gemini (${this.model})`;
  }

  async executePrompt(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use Gemini CLI in non-interactive mode with -p flag
      const args = [
        '-p',
        prompt,
      ];

      // Add model if specified
      if (this.model) {
        args.push('-m', this.model);
      }

      const proc = spawn('gemini', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Gemini CLI timeout after ${this.timeout}ms`));
      }, this.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          // Gemini might return non-zero but still have output
          if (stdout.trim()) {
            resolve(stdout.trim());
          } else {
            reject(new Error(`Gemini CLI exited with code ${code}: ${stderr}`));
          }
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Check if Gemini CLI is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('gemini', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }
}
