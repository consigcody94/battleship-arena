/**
 * Claude CLI adapter for Battleship
 */

import { spawn } from 'child_process';
import { AIPlayer } from './AIPlayer.js';
import { PlayerType } from '../game/types.js';

export class ClaudePlayer extends AIPlayer {
  type: PlayerType = 'claude';
  name = 'Claude';
  private model: string;
  private timeout: number;

  constructor(options: { model?: string; timeout?: number } = {}) {
    super();
    this.model = options.model || 'sonnet';
    this.timeout = options.timeout || 60000;
    this.name = `Claude (${this.model})`;
  }

  async executePrompt(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-p',
        prompt,
        '--output-format', 'text',
      ];

      const proc = spawn('claude', args, {
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
        reject(new Error(`Claude CLI timeout after ${this.timeout}ms`));
      }, this.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Check if Claude CLI is available
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], {
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
