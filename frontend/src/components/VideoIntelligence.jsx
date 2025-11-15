import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import ProductSidebar from './ProductSidebar';

export default function VideoIntelligence() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoContainerRef = useRef(null);
  const [sidebarHeight, setSidebarHeight] = useState(0);
  const [shoppingMap, setShoppingMap] = useState({});

  // Load videos on mount
  useEffect(() => {
    loadVideos();
  }, []);

  // Calculate sidebar height to match video player
  useEffect(() => {
    const updateSidebarHeight = () => {
      if (videoContainerRef.current) {
        const height = videoContainerRef.current.offsetHeight;
        setSidebarHeight(height);
      }
    };

    updateSidebarHeight();
    window.addEventListener('resize', updateSidebarHeight);

    return () => window.removeEventListener('resize', updateSidebarHeight);
  }, [selectedVideo]);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/videos');
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setVideos(data.data);
        // Auto-select first video that has HLS URL
        const videoWithHls = data.data.find(v => v.hls?.video_url);
        if (videoWithHls) {
          loadVideo(videoWithHls._id);
        } else {
          // Fallback to first video if none have HLS
          loadVideo(data.data[0]._id);
        }
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVideo = async (videoId) => {
    setIsAnalyzing(true);
    setProducts([]);
    setCurrentTime(0);
    setShoppingMap({});

    try {
      // Get video details
      const videoResponse = await fetch(`/api/videos/${videoId}`);
      const videoData = await videoResponse.json();
      setSelectedVideo(videoData);

      // Get/analyze products
      const productsResponse = await fetch(`/api/videos/${videoId}/products`);
      const productsData = await productsResponse.json();

      if (productsData.success) {
        setProducts(productsData.products || []);
      }
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Manual per-product enrichment
  const handleFindLinks = async (product) => {
    try {
      const affiliateTag = import.meta.env.VITE_AFFILIATE_TAG || null;
      const resp = await fetch('/api/shopping/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [{
            product_name: product.product_name,
            brand: product.brand,
            description: product.description,
          }],
          affiliate_tag: affiliateTag,
        }),
      });
      const shop = await resp.json();
      if (shop && shop.success && shop.results) {
        setShoppingMap((prev) => ({ ...prev, ...shop.results }));
      }
    } catch (e) {
      console.warn('Shopping enrichment failed:', e);
    }
  };

  const handleProductClick = (product) => {
    // Could add highlight effect or auto-scroll here if needed
    console.log('Product clicked:', product);
  };

  const getVideoName = (video) => {
    const name = video.system_metadata?.filename ||
           video.system_metadata?.video_title ||
           `Video ${video._id.slice(-8)}`;

    // Add indicator if video doesn't have HLS
    if (!video.hls?.video_url) {
      return `${name} (No stream available)`;
    }
    return name;
  };

  return (
    <div className="space-y-6 max-h-[calc(100vh-160px)] overflow-hidden">
      {/* Hero */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-primary-obsidian mb-3">
            Shop the Video.
          </h1>
          <p className="text-sm md:text-base text-primary-charcoal/90 max-w-xl">
            Drop into any moment and see every product, price, and link
            pulled out of the frame with gentle, cinematic UI.
          </p>
        </div>

        <div className="bg-primary-ghost/80 border border-primary-neutral/30 rounded-2xl px-4 py-3 text-xs md:text-sm text-primary-obsidian shadow-sm shadow-primary-obsidian/5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accents-sage/10 text-accents-sage text-xs">
              ✨
            </span>
            <p className="font-medium">How it works</p>
          </div>
          <p className="text-primary-charcoal/90">
            Choose a video → we analyze it → products appear on the right with rich shopping links.
          </p>
        </div>
      </div>

      {/* Video Selector */}
      <div className="bg-primary-ghost/80 border border-primary-neutral/30 rounded-2xl p-4 md:p-5 shadow-sm shadow-primary-obsidian/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary-charcoal/80 uppercase mb-1">
              Select a video
            </p>
            <p className="text-xs text-primary-charcoal/75">
              We’ll automatically stream it and highlight every shoppable moment.
            </p>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-primary-charcoal/80">
              <div className="w-4 h-4 border-2 border-accents-frost border-t-transparent rounded-full animate-spin" />
              Loading videos…
            </div>
          )}
        </div>

        <select
          className="w-full px-4 py-2.5 rounded-xl border border-primary-neutral/50 bg-primary-whisper/80
                     text-sm text-primary-obsidian shadow-inner shadow-primary-obsidian/5
                     focus:outline-none focus:ring-2 focus:ring-accents-sage/40 focus:border-accents-sage/60
                     transition-all duration-150"
          value={selectedVideo?._id || ''}
          onChange={(e) => loadVideo(e.target.value)}
        >
          {videos.map((video) => (
            <option key={video._id} value={video._id}>
              {getVideoName(video)}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content */}
      {selectedVideo && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Video Player (2/3 width) */}
          <div
            className="lg:col-span-2 bg-primary-ghost/80 border border-primary-neutral/30 rounded-2xl p-3 md:p-4 shadow-md shadow-primary-obsidian/8"
            ref={videoContainerRef}
          >
            {selectedVideo.local_url || selectedVideo.hls?.video_url ? (
              <VideoPlayer
                videoUrl={selectedVideo.local_url || selectedVideo.hls.video_url}
                products={products}
                onProductClick={handleProductClick}
                onTimeUpdate={setCurrentTime}
              />
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <p className="text-gray-600">Video not available</p>
              </div>
            )}
          </div>

          {/* Product Sidebar (1/3 width) - Match video player height */}
          <div
            className="bg-primary-ghost/80 border border-primary-neutral/30 rounded-2xl p-3 md:p-4 shadow-md shadow-primary-obsidian/8"
            style={{ height: sidebarHeight > 0 ? `${sidebarHeight}px` : 'auto' }}
          >
            <ProductSidebar
              products={products}
              currentTime={currentTime}
              onProductClick={handleProductClick}
              isLoading={isAnalyzing}
              shoppingMap={shoppingMap}
              onFindLinks={handleFindLinks}
            />
          </div>
        </div>
      )}
    </div>
  );
}
