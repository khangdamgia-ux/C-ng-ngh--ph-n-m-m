import { GpsCard } from '../components/GpsCard';
import { MapView } from '../components/MapView';
import { useTour } from '../tour/TourContext';

/** UI04: bản đồ di tích + vị trí GPS của chính người dùng. */
export function MapPage() {
  const tour = useTour();
  return (
    <div className="map-page">
      <MapView places={tour.places} user={tour.position} activeCode={tour.nowPlaying?.code} locate />
      <GpsCard />
    </div>
  );
}
