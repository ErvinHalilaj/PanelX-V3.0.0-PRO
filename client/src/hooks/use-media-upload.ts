import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface UploadedFile {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  url: string;
}

interface Subtitle {
  filename: string;
  language: string;
  size: number;
  url: string;
}

/**
 * Upload poster
 */
export function useUploadPoster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, movieId }: { file: File; movieId: number }) => {
      const formData = new FormData();
      formData.append('poster', file);
      formData.append('movieId', movieId.toString());

      const { data } = await axios.post<UploadedFile>('/api/media/posters/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posters', variables.movieId] });
    },
  });
}

/**
 * Upload backdrop
 */
export function useUploadBackdrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, movieId }: { file: File; movieId: number }) => {
      const formData = new FormData();
      formData.append('backdrop', file);
      formData.append('movieId', movieId.toString());

      const { data } = await axios.post<UploadedFile>('/api/media/backdrops/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backdrops'] });
    },
  });
}

/**
 * Upload subtitle
 */
export function useUploadSubtitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, movieId, language }: { file: File; movieId: number; language: string }) => {
      const formData = new FormData();
      formData.append('subtitle', file);
      formData.append('movieId', movieId.toString());
      formData.append('language', language);

      const { data } = await axios.post<UploadedFile>('/api/media/subtitles/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtitles', variables.movieId] });
    },
  });
}

/**
 * Get posters for movie
 */
export function useMoviePosters(movieId: number) {
  return useQuery({
    queryKey: ['posters', movieId],
    queryFn: async () => {
      const { data } = await axios.get<{ posters: Array<{ filename: string; url: string }> }>(
        `/api/media/posters/movie/${movieId}`
      );
      return data.posters;
    },
    enabled: !!movieId,
  });
}

/**
 * Get subtitles for movie
 */
export function useMovieSubtitles(movieId: number) {
  return useQuery({
    queryKey: ['subtitles', movieId],
    queryFn: async () => {
      const { data } = await axios.get<{ subtitles: Subtitle[] }>(
        `/api/media/subtitles/movie/${movieId}`
      );
      return data.subtitles;
    },
    enabled: !!movieId,
  });
}

/**
 * Delete poster
 */
export function useDeletePoster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (filename: string) => {
      await axios.delete(`/api/media/posters/${filename}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posters'] });
    },
  });
}

/**
 * Delete subtitle
 */
export function useDeleteSubtitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (filename: string) => {
      await axios.delete(`/api/media/subtitles/${filename}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtitles'] });
    },
  });
}
