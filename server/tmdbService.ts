/**
 * TMDB (The Movie Database) API Service
 * Fetches movie and TV series metadata
 */

import axios from 'axios';

interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  genre_ids: number[];
  runtime?: number;
  tagline?: string;
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
    }>;
  };
  videos?: {
    results: Array<{
      key: string;
      site: string;
      type: string;
      name: string;
    }>;
  };
}

interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  status?: string;
  tagline?: string;
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }>;
  };
}

class TMDBService {
  private apiKey: string;
  private baseUrl = 'https://api.themoviedb.org/3';
  private imageBaseUrl = 'https://image.tmdb.org/t/p';

  constructor() {
    this.apiKey = process.env.TMDB_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[TMDBService] No TMDB_API_KEY found in environment');
    }
  }

  /**
   * Check if TMDB API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for movies
   */
  async searchMovies(query: string, page = 1): Promise<{ results: TMDBMovie[]; total_results: number }> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search/movie`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
          include_adult: false,
        },
      });

      return response.data;
    } catch (error) {
      console.error('[TMDBService] Search movies error:', error);
      throw error;
    }
  }

  /**
   * Search for TV series
   */
  async searchSeries(query: string, page = 1): Promise<{ results: TMDBSeries[]; total_results: number }> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search/tv`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
        },
      });

      return response.data;
    } catch (error) {
      console.error('[TMDBService] Search series error:', error);
      throw error;
    }
  }

  /**
   * Get movie details by ID
   */
  async getMovieDetails(movieId: number): Promise<TMDBMovie> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/movie/${movieId}`, {
        params: {
          api_key: this.apiKey,
          append_to_response: 'credits,videos',
        },
      });

      return response.data;
    } catch (error) {
      console.error('[TMDBService] Get movie details error:', error);
      throw error;
    }
  }

  /**
   * Get TV series details by ID
   */
  async getSeriesDetails(seriesId: number): Promise<TMDBSeries> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/tv/${seriesId}`, {
        params: {
          api_key: this.apiKey,
          append_to_response: 'credits,videos',
        },
      });

      return response.data;
    } catch (error) {
      console.error('[TMDBService] Get series details error:', error);
      throw error;
    }
  }

  /**
   * Get image URL
   */
  getImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
    if (!path) return null;
    return `${this.imageBaseUrl}/${size}${path}`;
  }

  /**
   * Get poster URL
   */
  getPosterUrl(posterPath: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
    return this.getImageUrl(posterPath, size);
  }

  /**
   * Get backdrop URL
   */
  getBackdropUrl(backdropPath: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'): string | null {
    return this.getImageUrl(backdropPath, size as any);
  }

  /**
   * Get YouTube trailer URL
   */
  getTrailerUrl(movie: TMDBMovie): string | null {
    if (!movie.videos?.results) return null;

    const trailer = movie.videos.results.find(
      (video) => video.type === 'Trailer' && video.site === 'YouTube'
    );

    if (!trailer) return null;
    return `https://www.youtube.com/watch?v=${trailer.key}`;
  }

  /**
   * Get popular movies
   */
  async getPopularMovies(page = 1): Promise<{ results: TMDBMovie[]; total_results: number }> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/movie/popular`, {
        params: {
          api_key: this.apiKey,
          page,
        },
      });

      return response.data;
    } catch (error) {
      console.error('[TMDBService] Get popular movies error:', error);
      throw error;
    }
  }

  /**
   * Get popular TV series
   */
  async getPopularSeries(page = 1): Promise<{ results: TMDBSeries[]; total_results: number }> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/tv/popular`, {
        params: {
          api_key: this.apiKey,
          page,
        },
      });

      return response.data;
    } catch (error) {
      console.error('[TMDBService] Get popular series error:', error);
      throw error;
    }
  }

  /**
   * Get movie genres
   */
  async getMovieGenres(): Promise<Array<{ id: number; name: string }>> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/genre/movie/list`, {
        params: {
          api_key: this.apiKey,
        },
      });

      return response.data.genres;
    } catch (error) {
      console.error('[TMDBService] Get movie genres error:', error);
      throw error;
    }
  }

  /**
   * Get TV genres
   */
  async getTVGenres(): Promise<Array<{ id: number; name: string }>> {
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/genre/tv/list`, {
        params: {
          api_key: this.apiKey,
        },
      });

      return response.data.genres;
    } catch (error) {
      console.error('[TMDBService] Get TV genres error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const tmdbService = new TMDBService();
