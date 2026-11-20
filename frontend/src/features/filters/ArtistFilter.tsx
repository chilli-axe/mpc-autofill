import Form from "react-bootstrap/Form";

import { useGetArtistsQuery } from "@/store/api";

interface ArtistFilterProps {
  artist: string;
  setArtist: (value: string) => void;
}

/**
 * A typeable artist filter. Suggestions come from the backend's list of
 * canonical artists (when connected) via a native datalist, but any value
 * can be typed freely.
 */
export const ArtistFilter = ({ artist, setArtist }: ArtistFilterProps) => {
  const getArtistsQuery = useGetArtistsQuery();
  const artistNames = getArtistsQuery.data ?? [];

  return (
    <Form.Group className="mb-2">
      <Form.Label htmlFor="artist-filter">Artist</Form.Label>
      <Form.Control
        id="artist-filter"
        list="artist-filter-suggestions"
        value={artist}
        onChange={(event) => setArtist(event.target.value)}
        placeholder="Filter by artist..."
      />
      <datalist id="artist-filter-suggestions">
        {artistNames.map((artistName) => (
          <option key={artistName} value={artistName} />
        ))}
      </datalist>
    </Form.Group>
  );
};
