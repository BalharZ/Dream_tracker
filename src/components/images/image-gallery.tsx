import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Image as ImageIcon, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export function ImageGallery({
  onSelect,
  isOpen,
  setIsOpen,
}: {
  onSelect: (imageUrl: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<Array<{id: string; urls: {regular: string, thumb: string}; alt_description: string | null}>>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && images.length === 0) {
      fetchGalleryImages();
    }
  }, [isOpen, images.length]);

  const fetchGalleryImages = async () => {
    if (!UNSPLASH_ACCESS_KEY) {
      console.error("Missing VITE_UNSPLASH_ACCESS_KEY");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/photos/random?count=12&client_id=${UNSPLASH_ACCESS_KEY}`
      );
      if (!response.ok) throw new Error("Failed to fetch images");
      const data = await response.json();
      setImages(data);
    } catch (error) {
      console.error("Error fetching gallery images:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!user) return;
    setLoading(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("images").upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(fileName);
      onSelect(urlData.publicUrl);
      setIsOpen(false);
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const searchImages = async (searchQuery: string) => {
    if (!UNSPLASH_ACCESS_KEY) return;
    if (!searchQuery.trim()) {
      fetchGalleryImages();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=12&client_id=${UNSPLASH_ACCESS_KEY}`
      );
      if (!response.ok) throw new Error("Failed to search images");
      const data = await response.json();
      setImages(data.results);
    } catch (error) {
      console.error("Error searching images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => searchImages(value), 500);
    setSearchTimeout(timeout);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Search images..."
                value={query}
                onChange={handleSearchChange}
                className="flex-1"
              />
              <Button onClick={() => searchImages(query)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            <div className="flex gap-2 justify-center mt-2 md:mt-0">
              <Button onClick={handleUploadClick} variant="outline" disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No images found. Try a different search or upload your own.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative overflow-hidden rounded-md aspect-square cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    onSelect(image.urls.regular);
                    setIsOpen(false);
                  }}
                >
                  <img
                    src={image.urls.thumb}
                    alt={image.alt_description || "Image"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground pt-2">
            Images powered by Unsplash. You can also upload your own images.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
