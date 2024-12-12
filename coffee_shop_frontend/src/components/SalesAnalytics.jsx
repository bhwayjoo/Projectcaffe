import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const SalesAnalytics = () => {
  const [salesData, setSalesData] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    bestSellers: [],
    monthlySales: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const [analyticsResponse, bestSellersResponse] = await Promise.all([
          axios.get('http://localhost:8080/api/orders/analytics'),
          axios.get('http://localhost:8080/api/products/best-sellers')
        ]);

        setSalesData({
          ...analyticsResponse.data,
          bestSellers: bestSellersResponse.data
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch sales data');
        setLoading(false);
        console.error('Error fetching sales data:', err);
      }
    };

    // For development, using sample data
    const sampleData = {
      totalRevenue: 15000,
      totalOrders: 500,
      averageOrderValue: 30,
      bestSellers: [
        { id: 1, name: "Espresso", totalSales: 150, revenue: 750 },
        { id: 2, name: "Cappuccino", totalSales: 120, revenue: 720 },
        { id: 3, name: "Latte", totalSales: 100, revenue: 600 },
      ],
      monthlySales: [
        { month: "Jan", revenue: 1200 },
        { month: "Feb", revenue: 1400 },
        { month: "Mar", revenue: 1100 },
        { month: "Apr", revenue: 1600 },
        { month: "May", revenue: 1800 },
        { month: "Jun", revenue: 2000 },
      ]
    };
    setSalesData(sampleData);
    setLoading(false);
  }, []);

  const chartData = {
    labels: salesData.monthlySales.map(sale => sale.month),
    datasets: [
      {
        label: 'Monthly Revenue',
        data: salesData.monthlySales.map(sale => sale.revenue),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly Revenue',
      },
    },
  };

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
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
            <p className="text-2xl font-bold text-green-600">
              ${salesData.totalRevenue.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
            <p className="text-2xl font-bold text-green-600">
              {salesData.totalOrders}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Average Order Value</h3>
            <p className="text-2xl font-bold text-green-600">
              ${salesData.averageOrderValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="chart">
            <TabsList className="mb-4">
              <TabsTrigger value="chart">Revenue Chart</TabsTrigger>
              <TabsTrigger value="bestsellers">Best Sellers</TabsTrigger>
            </TabsList>

            <TabsContent value="chart">
              <div className="h-[400px]">
                <Bar options={chartOptions} data={chartData} />
              </div>
            </TabsContent>

            <TabsContent value="bestsellers">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {salesData.bestSellers.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="py-4 px-4 text-sm text-gray-900">{product.name}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">{product.totalSales}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">${product.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesAnalytics;
