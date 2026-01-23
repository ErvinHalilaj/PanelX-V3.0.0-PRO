import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface TMDBMovie {
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
  runtime?: number;
  tagline?: string;
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
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

export interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  tagline?: string;
}

/**
 * Hook to search movies on TMDB
 */
export function useSearchMovies(query: string, page = 1, enabled = true) {
  return useQuery<{ results: TMDBMovie[]; total_results: number }>({
    queryKey: ["/api/tmdb/search/movies", query, page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tmdb/search/movies?query=${encodeURIComponent(query)}&page=${page}`);
      return res.json();
    },
    enabled: enabled && !!query,
  });
}

/**
 * Hook to search TV series on TMDB
 */
export function useSearchSeries(query: string, page = 1, enabled = true) {
  return useQuery<{ results: TMDBSeries[]; total_results: number }>({
    queryKey: ["/api/tmdb/search/series", query, page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tmdb/search/series?query=${encodeURIComponent(query)}&page=${page}`);
      return res.json();
    },
    enabled: enabled && !!query,
  });
}

/**
 * Hook to get movie details
 */
export function useMovieDetails(movieId: number, enabled = true) {
  return useQuery<TMDBMovie>({
    queryKey: ["/api/tmdb/movie", movieId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tmdb/movie/${movieId}`);
      return res.json();
    },
    enabled,
  });
}

/**
 * Hook to get series details
 */
export function useSeriesDetails(seriesId: number, enabled = true) {
  return useQuery<TMDBSeries>({
    queryKey: ["/api/tmdb/series", seriesId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tmdb/series/${seriesId}`);
      return res.json();
    },
    enabled,
  });
}

/**
 * Hook to get popular movies
 */
export function usePopularMovies(page = 1) {
  return useQuery<{ results: TMDBMovie[]; total_results: number }>({
    queryKey: ["/api/tmdb/popular/movies", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tmdb/popular/movies?page=${page}`);
      return res.json();
    },
  });
}

/**
 * Hook to get popular series
 */
export function usePopularSeries(page = 1) {
  return useQuery<{ results: TMDBSeries[]; total_results: number }>({
    queryKey: ["/api/tmdb/popular/series", page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tmdb/popular/series?page=${page}`);
      return res.json();
    },
  });
}

/**
 * Helper to get TMDB image URL
 */
export function getTMDBImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/**
 * Helper to get YouTube trailer embed URL
 */
export function getYouTubeEmbedUrl(key: string): string {
  return `https://www.youtube.com/embed/${key}`;
}
