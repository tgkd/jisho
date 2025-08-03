import { SearchRankingConfig } from '../services/database/types';

/**
 * Unit tests for frequency ranking functionality
 * These test the ranking configuration and interfaces without requiring database access
 */

describe('Frequency Ranking Configuration', () => {
  test('SearchRankingConfig interface validation', () => {
    const validConfig: SearchRankingConfig = {
      frequencyWeight: 0.3,
      lengthWeight: 0.2,
      exactMatchBoost: 10.0,
      enableFrequencyRanking: true
    };

    expect(validConfig.frequencyWeight).toBeGreaterThanOrEqual(0);
    expect(validConfig.frequencyWeight).toBeLessThanOrEqual(1);
    expect(validConfig.lengthWeight).toBeGreaterThanOrEqual(0);
    expect(validConfig.lengthWeight).toBeLessThanOrEqual(1);
    expect(validConfig.exactMatchBoost).toBeGreaterThan(0);
    expect(typeof validConfig.enableFrequencyRanking).toBe('boolean');
  });

  test('frequency weight bounds validation', () => {
    const testWeights = [0, 0.1, 0.5, 0.9, 1.0];
    
    testWeights.forEach(weight => {
      const config: SearchRankingConfig = {
        frequencyWeight: weight,
        lengthWeight: 0.2,
        exactMatchBoost: 10.0,
        enableFrequencyRanking: true
      };
      
      expect(config.frequencyWeight).toBeGreaterThanOrEqual(0);
      expect(config.frequencyWeight).toBeLessThanOrEqual(1);
    });
  });

  test('exact match boost should be positive', () => {
    const testBoosts = [1, 5, 10, 50, 100];
    
    testBoosts.forEach(boost => {
      const config: SearchRankingConfig = {
        frequencyWeight: 0.3,
        lengthWeight: 0.2,
        exactMatchBoost: boost,
        enableFrequencyRanking: true
      };
      
      expect(config.exactMatchBoost).toBeGreaterThan(0);
    });
  });

  test('ranking disabled configuration', () => {
    const disabledConfig: SearchRankingConfig = {
      frequencyWeight: 0,
      lengthWeight: 0,
      exactMatchBoost: 1,
      enableFrequencyRanking: false
    };

    expect(disabledConfig.enableFrequencyRanking).toBe(false);
    expect(disabledConfig.frequencyWeight).toBe(0);
  });
});

describe('Frequency Score Calculations', () => {
  test('frequency score normalization', () => {
    // Test the frequency score calculation logic
    const calculateFrequencyScore = (rank: number, totalEntries: number): number => {
      const normalizedRank = rank / totalEntries;
      const score = Math.round((1 - normalizedRank) * 1000000);
      return Math.max(0, score);
    };

    // Test with various rank positions
    expect(calculateFrequencyScore(1, 100000)).toBe(999990); // Most frequent
    expect(calculateFrequencyScore(50000, 100000)).toBe(500000); // Middle frequency
    expect(calculateFrequencyScore(100000, 100000)).toBe(0); // Least frequent
    
    // Test edge cases
    expect(calculateFrequencyScore(0, 100000)).toBe(1000000); // Rank 0 edge case
    expect(calculateFrequencyScore(1, 1)).toBe(0); // Single entry
  });

  test('frequency ranking order', () => {
    // Simulate frequency scores for different words
    const words = [
      { word: 'は', frequency_score: 900000 }, // Very common particle
      { word: '食べる', frequency_score: 800000 }, // Common verb
      { word: '珍しい', frequency_score: 300000 }, // Less common adjective
      { word: '稀少', frequency_score: 100000 }, // Rare word
      { word: '無', frequency_score: 0 }, // No frequency data
    ];

    // Sort by frequency (higher scores first)
    const sorted = words.sort((a, b) => {
      if (a.frequency_score === 0 && b.frequency_score === 0) return 0;
      if (a.frequency_score === 0) return 1;
      if (b.frequency_score === 0) return -1;
      return b.frequency_score - a.frequency_score;
    });

    expect(sorted[0].word).toBe('は');
    expect(sorted[1].word).toBe('食べる');
    expect(sorted[2].word).toBe('珍しい');
    expect(sorted[3].word).toBe('稀少');
    expect(sorted[4].word).toBe('無');
  });
});

describe('Priority Tag Mappings', () => {
  test('JMdict priority score mappings', () => {
    const priorityScores: { [key: string]: number } = {
      'news1': 900000,
      'news2': 800000,
      'ichi1': 850000,
      'ichi2': 750000,
      'spec1': 700000,
      'spec2': 650000,
      'gai1': 600000,
      'gai2': 550000,
    };

    // Verify that news1 is higher than news2
    expect(priorityScores.news1).toBeGreaterThan(priorityScores.news2);
    
    // Verify that ichi1 is higher than ichi2
    expect(priorityScores.ichi1).toBeGreaterThan(priorityScores.ichi2);
    
    // Verify that specialty scores are reasonable
    expect(priorityScores.spec1).toBeGreaterThan(priorityScores.spec2);
    
    // Verify general hierarchy
    expect(priorityScores.news1).toBeGreaterThan(priorityScores.ichi2);
    expect(priorityScores.ichi1).toBeGreaterThan(priorityScores.spec1);
  });

  test('priority tag processing', () => {
    const processPriorityTags = (prioritiesJson: string | null): number => {
      if (!prioritiesJson) return 0;
      
      try {
        const priorities: string[] = JSON.parse(prioritiesJson);
        const priorityScores: { [key: string]: number } = {
          'news1': 900000,
          'news2': 800000,
          'ichi1': 850000,
        };
        
        let maxScore = 0;
        priorities.forEach(priority => {
          if (priorityScores[priority]) {
            maxScore = Math.max(maxScore, priorityScores[priority]);
          }
        });
        
        return maxScore;
      } catch {
        return 0;
      }
    };

    expect(processPriorityTags('["news1", "ichi1"]')).toBe(900000);
    expect(processPriorityTags('["news2"]')).toBe(800000);
    expect(processPriorityTags(null)).toBe(0);
    expect(processPriorityTags('invalid json')).toBe(0);
    expect(processPriorityTags('[]')).toBe(0);
  });
});