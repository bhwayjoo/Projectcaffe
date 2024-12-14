import { useState, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';
import { Card, CardContent } from "./ui/card";
import { useToast } from './ui/use-toast';
import { api } from '../api/customAcios';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await api.get('/reviews/');
        setReviews(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch reviews');
        toast({
          title: "Error",
          description: "Failed to load reviews. Please try again later.",
          variant: "destructive",
        });
        setLoading(false);
        console.error('Error fetching reviews:', err);
      }
    };

    fetchReviews();
  }, [toast]);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );

  if (error) return (
    <div className="text-center text-red-500 p-4">
      {error}
    </div>
  );

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Customer Reviews</h2>
        <div className="space-y-6">
          {reviews.length === 0 ? (
            <p className="text-center text-gray-500">No reviews yet</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800">Order #{review.order_id}</h3>
                    <p className="text-sm text-gray-500">
                      Order Date: {new Date(review.order_date).toLocaleDateString()} {new Date(review.order_date).toLocaleTimeString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      Review Date: {new Date(review.created_at).toLocaleDateString()} {new Date(review.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {[...Array(5)].map((_, index) => (
                      <FaStar
                        key={index}
                        className={index < review.rating ? 'text-yellow-400' : 'text-gray-300'}
                        size={20}
                      />
                    ))}
                  </div>
                </div>
                
                <p className="text-gray-700 mb-4">{review.comment || 'No comment provided'}</p>
                
                <div className="text-sm text-gray-500">
                  <h4 className="font-semibold mb-2">Order Items:</h4>
                  {review.order_items.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {review.order_items.map((item, index) => (
                        <li key={index} className="flex justify-between items-center">
                          <span>{item.name} x{item.quantity}</span>
                          <span className="text-gray-600">${item.price}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No items available</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Reviews;
