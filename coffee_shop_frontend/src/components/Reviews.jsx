import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaStar } from 'react-icons/fa';
import { Card, CardContent } from "./ui/card";

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await axios.get('http://localhost:8080/api/reviews');
        setReviews(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch reviews');
        setLoading(false);
        console.error('Error fetching reviews:', err);
      }
    };

    // For development, using sample data
    const sampleReviews = [
      {
        id: 1,
        customerName: "order 1",
        rating: 5,
        comment: "Excellent coffee and service!",
        createdAt: "2023-12-01",
        productName: "Espresso"
      },
      {
        id: 2,
        customerName: "order 2",
        rating: 4,
        comment: "Great atmosphere, lovely pastries",
        createdAt: "2023-12-05",
        productName: "Croissant"
      },
    ];
    setReviews(sampleReviews);
    setLoading(false);
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
    </div>
  );

  if (error) return (
    <div className="text-red-500 text-center p-4">
      {error}
    </div>
  );

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Order Reviews</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comment</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reviews.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="py-4 px-4 text-sm text-gray-900">{review.customerName}</td>
                  <td className="py-4 px-4 text-sm text-gray-900">{review.productName}</td>
                  <td className="py-4 px-4">
                    <div className="flex">
                      {[...Array(5)].map((_, index) => (
                        <FaStar
                          key={index}
                          className={index < review.rating ? 'text-yellow-400' : 'text-gray-300'}
                          size={16}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-900">{review.comment}</td>
                  <td className="py-4 px-4 text-sm text-gray-900">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default Reviews;
