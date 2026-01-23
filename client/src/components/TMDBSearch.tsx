import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, 
  Loader2,
  Star,
  Calendar,
  Film,
  Tv,
  ExternalLink
} from "lucide-react";
import {
  useSearchMovies,
  useSearchSeries,
  getTMDBImageUrl,
  type TMDBMovie,
  type TMDBSeries
} from "@/hooks/use-tmdb";

interface TMDBSearchProps {
  type: 'movie' | 'series';
  onSelect: (item: TMDBMovie | TMDBSeries) => void;
}

export function TMDBSearch({ type, onSelect }: TMDBSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: movieData, isLoading: moviesLoading } = useSearchMovies(
    debouncedQuery,
    1,
    type === 'movie' && !!debouncedQuery
  );

  const { data: seriesData, isLoading: seriesLoading } = useSearchSeries(
    debouncedQuery,
    1,
    type === 'series' && !!debouncedQuery
  );

  const isLoading = moviesLoading || seriesLoading;
  const results = type === 'movie' ? movieData?.results : seriesData?.results;

  const handleSearch = () => {
    setDebouncedQuery(query);
  };

  const handleSelect = (item: any) => {
    onSelect(item);
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2"
      >
        <Search className="w-4 h-4" />
        Search TMDB
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {type === 'movie' ? <Film className="w-5 h-5" /> : <Tv className="w-5 h-5" />}
              Search {type === 'movie' ? 'Movies' : 'TV Series'} on TMDB
            </DialogTitle>
          </DialogHeader>

          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder={`Search for ${type === 'movie' ? 'a movie' : 'a TV series'}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!query || isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Searching...
              </div>
            ) : !debouncedQuery ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Enter a search query to find {type === 'movie' ? 'movies' : 'TV series'}</p>
              </div>
            ) : !results?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No results found for "{debouncedQuery}"</p>
              </div>
            ) : (
              results.map((item: any) => {
                const title = type === 'movie' ? item.title : item.name;
                const releaseDate = type === 'movie' ? item.release_date : item.first_air_date;
                const posterUrl = getTMDBImageUrl(item.poster_path, 'w185');

                return (
                  <Card
                    key={item.id}
                    className="p-4 bg-card/40 border-white/5 hover:bg-card/60 transition-colors cursor-pointer"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="flex gap-4">
                      {/* Poster */}
                      <div className="w-20 h-30 flex-shrink-0">
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={title}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/5 rounded flex items-center justify-center">
                            {type === 'movie' ? (
                              <Film className="w-8 h-8 text-muted-foreground/30" />
                            ) : (
                              <Tv className="w-8 h-8 text-muted-foreground/30" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-white truncate">
                            {title}
                          </h4>
                          <div className="flex items-center gap-1 text-yellow-500 flex-shrink-0">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-medium">
                              {item.vote_average.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          {releaseDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(releaseDate).getFullYear()}
                            </span>
                          )}
                          <span>{item.vote_count} votes</span>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.overview || 'No description available'}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            TMDB ID: {item.id}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `https://www.themoviedb.org/${type}/${item.id}`,
                                '_blank'
                              );
                            }}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View on TMDB
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
