import { useState } from 'react';
import { useSearchTMDB, useMovieDetails, useSeriesDetails } from '@/hooks/use-tmdb';
import { 
  useUploadPoster, 
  useUploadBackdrop, 
  useUploadSubtitle,
  useMoviePosters,
  useMovieSubtitles,
  useDeletePoster,
  useDeleteSubtitle
} from '@/hooks/use-media-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Upload, ImagePlus, FileText, Trash2, Download, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MediaManager() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'movie' | 'series'>('movie');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'poster' | 'backdrop' | 'subtitle'>('poster');
  const [subtitleLanguage, setSubtitleLanguage] = useState('en');

  // TMDB hooks
  const searchResults = useSearchTMDB(searchQuery, searchType);
  const movieDetails = useMovieDetails(selectedId || 0, searchType === 'movie');
  const seriesDetails = useSeriesDetails(selectedId || 0, searchType === 'series');

  // Media upload hooks
  const uploadPoster = useUploadPoster();
  const uploadBackdrop = useUploadBackdrop();
  const uploadSubtitle = useUploadSubtitle();
  const moviePosters = useMoviePosters(selectedId || 0);
  const movieSubtitles = useMovieSubtitles(selectedId || 0);
  const deletePoster = useDeletePoster();
  const deleteSubtitle = useDeleteSubtitle();

  const details = searchType === 'movie' ? movieDetails.data : seriesDetails.data;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is triggered automatically by query change
  };

  const handleSelectItem = (id: number) => {
    setSelectedId(id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    try {
      if (uploadType === 'poster') {
        await uploadPoster.mutateAsync({ file, movieId: selectedId });
        toast({ title: 'Success', description: 'Poster uploaded successfully' });
      } else if (uploadType === 'backdrop') {
        await uploadBackdrop.mutateAsync({ file, movieId: selectedId });
        toast({ title: 'Success', description: 'Backdrop uploaded successfully' });
      } else if (uploadType === 'subtitle') {
        await uploadSubtitle.mutateAsync({ file, movieId: selectedId, language: subtitleLanguage });
        toast({ title: 'Success', description: 'Subtitle uploaded successfully' });
      }
      setUploadDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' });
    }
  };

  const handleDeletePoster = async (filename: string) => {
    try {
      await deletePoster.mutateAsync(filename);
      toast({ title: 'Success', description: 'Poster deleted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete poster', variant: 'destructive' });
    }
  };

  const handleDeleteSubtitle = async (filename: string) => {
    try {
      await deleteSubtitle.mutateAsync(filename);
      toast({ title: 'Success', description: 'Subtitle deleted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete subtitle', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Media Manager</h1>
        <p className="text-muted-foreground">Manage posters, backdrops, and subtitles for VOD content</p>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Search Content</CardTitle>
          <CardDescription>Search for movies or series to manage media</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search movies or series..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">Movie</SelectItem>
                  <SelectItem value="series">Series</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.data && searchResults.data.results.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {searchResults.data.results.map((item: any) => (
                <Card
                  key={item.id}
                  className={`cursor-pointer hover:ring-2 hover:ring-primary transition-all ${
                    selectedId === item.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleSelectItem(item.id)}
                >
                  <CardContent className="p-2">
                    {item.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                        alt={item.title || item.name}
                        className="w-full rounded-md mb-2"
                      />
                    )}
                    <p className="text-sm font-medium truncate">{item.title || item.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      <span className="text-xs text-muted-foreground">{item.vote_average?.toFixed(1)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Item Details */}
      {selectedId && details && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle>{details.title || details.name}</CardTitle>
                <CardDescription>
                  {details.release_date || details.first_air_date} • TMDB ID: {details.id}
                </CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    <span className="text-sm font-medium">{details.vote_average?.toFixed(1)}</span>
                  </div>
                  <Badge variant="secondary">{details.vote_count} votes</Badge>
                </div>
              </div>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Media
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Media</DialogTitle>
                    <DialogDescription>
                      Upload poster, backdrop, or subtitle for {details.title || details.name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Upload Type</Label>
                      <Select value={uploadType} onValueChange={(v: any) => setUploadType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="poster">Poster (500x750)</SelectItem>
                          <SelectItem value="backdrop">Backdrop (1920x1080)</SelectItem>
                          <SelectItem value="subtitle">Subtitle (SRT/VTT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {uploadType === 'subtitle' && (
                      <div>
                        <Label>Language</Label>
                        <Select value={subtitleLanguage} onValueChange={setSubtitleLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                            <SelectItem value="it">Italian</SelectItem>
                            <SelectItem value="pt">Portuguese</SelectItem>
                            <SelectItem value="ru">Russian</SelectItem>
                            <SelectItem value="zh">Chinese</SelectItem>
                            <SelectItem value="ja">Japanese</SelectItem>
                            <SelectItem value="ko">Korean</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>File</Label>
                      <Input
                        type="file"
                        accept={uploadType === 'subtitle' ? '.srt,.vtt,.ass,.ssa' : 'image/*'}
                        onChange={handleFileUpload}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="posters">
              <TabsList>
                <TabsTrigger value="posters">
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Posters
                </TabsTrigger>
                <TabsTrigger value="subtitles">
                  <FileText className="w-4 h-4 mr-2" />
                  Subtitles
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posters" className="space-y-4">
                {/* TMDB Posters */}
                {details.poster_path && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">TMDB Poster</h3>
                    <img
                      src={`https://image.tmdb.org/t/p/w500${details.poster_path}`}
                      alt="TMDB Poster"
                      className="w-48 rounded-md border"
                    />
                  </div>
                )}

                {/* Uploaded Posters */}
                {moviePosters.data && moviePosters.data.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Uploaded Posters</h3>
                    <div className="grid grid-cols-4 gap-4">
                      {moviePosters.data.map((poster) => (
                        <div key={poster.filename} className="relative group">
                          <img
                            src={poster.url}
                            alt="Uploaded Poster"
                            className="w-full rounded-md border"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeletePoster(poster.filename)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="subtitles" className="space-y-4">
                {movieSubtitles.data && movieSubtitles.data.length > 0 ? (
                  <div className="space-y-2">
                    {movieSubtitles.data.map((subtitle) => (
                      <Card key={subtitle.filename}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{subtitle.language.toUpperCase()}</p>
                              <p className="text-sm text-muted-foreground">
                                {(subtitle.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={subtitle.url} download>
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubtitle(subtitle.filename)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No subtitles uploaded yet
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
