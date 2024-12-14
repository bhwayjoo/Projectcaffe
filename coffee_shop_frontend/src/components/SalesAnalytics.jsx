import { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Card, CardContent } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "./ui/use-toast";
import { api } from '../api/customAcios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

const SalesAnalytics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('DAY');
  const [salesData, setSalesData] = useState({
    daily_sales: { amount: 0, order_count: 0 },
    period_sales: { amount: 0, order_count: 0 },
    period: { start_date: '', end_date: '' },
    top_selling_items: [],
    time_series: []
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSalesData = async (period) => {
    try {
      setLoading(true);
      // Convert period to backend format
      const periodMap = {
        'HOUR': 'hourly',
        'DAY': 'daily',
        'MONTH': 'monthly',
        'YEAR': 'yearly'
      };

      // Calculate date range based on period
      const end_date = new Date();
      let start_date = new Date();
      
      switch(period) {
        case 'HOUR':
          start_date.setHours(start_date.getHours() - 24);
          break;
        case 'DAY':
          start_date.setDate(start_date.getDate() - 30);
          break;
        case 'MONTH':
          start_date.setMonth(start_date.getMonth() - 12);
          break;
        case 'YEAR':
          start_date.setFullYear(start_date.getFullYear() - 5);
          break;
      }

      const params = {
        period: periodMap[period],
        start_date: start_date.toISOString().split('T')[0],
        end_date: end_date.toISOString().split('T')[0]
      };

      const response = await api.get('/orders/analytics/', { params });
      setSalesData(response.data);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de vente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData(selectedPeriod);
  }, [selectedPeriod]);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );

  const getPeriodLabel = (period) => {
    switch(period) {
      case 'HOUR': return 'par heure';
      case 'DAY': return 'par jour';
      case 'MONTH': return 'par mois';
      case 'YEAR': return 'par année';
      default: return '';
    }
  };

  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="flex justify-between items-center mb-4">
        <TabsList>
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="top-items">Top Articles</TabsTrigger>
          <TabsTrigger value="chart">Graphiques</TabsTrigger>
        </TabsList>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sélectionner la période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HOUR">Par heure</SelectItem>
            <SelectItem value="DAY">Par jour</SelectItem>
            <SelectItem value="MONTH">Par mois</SelectItem>
            <SelectItem value="YEAR">Par année</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">
              Ventes {getPeriodLabel(selectedPeriod)}
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(salesData.daily_sales?.amount || 0)}
            </p>
            <p className="text-sm text-gray-500">
              {salesData.daily_sales?.order_count || 0} {(salesData.daily_sales?.order_count || 0) === 1 ? 'commande' : 'commandes'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Ventes Totales</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(salesData.period_sales?.amount || 0)}
            </p>
            <p className="text-sm text-gray-500">
              {salesData.period_sales?.order_count || 0} {(salesData.period_sales?.order_count || 0) === 1 ? 'commande' : 'commandes'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {salesData.period?.start_date ? new Date(salesData.period.start_date).toLocaleDateString('fr-FR') : ''} - {salesData.period?.end_date ? new Date(salesData.period.end_date).toLocaleDateString('fr-FR') : ''}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Valeur Moyenne</h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(salesData.period_sales?.order_count ? (salesData.period_sales.amount / salesData.period_sales.order_count) : 0)}
            </p>
            <p className="text-xs text-gray-400 mt-2">Basé sur la période sélectionnée</p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="chart">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="grid grid-cols-1 gap-6">
            {/* Sales Chart */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Ventes</h3>
              <div className="h-[300px] w-full">
                <Line 
                  data={{
                    labels: (salesData.time_series || []).map(item => {
                      const date = new Date(item.timestamp);
                      switch(selectedPeriod) {
                        case 'HOUR':
                          return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        case 'DAY':
                          return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                        case 'MONTH':
                          return date.toLocaleDateString('fr-FR', { month: 'long' });
                        case 'YEAR':
                          return date.getFullYear().toString();
                        default:
                          return item.timestamp;
                      }
                    }),
                    datasets: [{
                      label: 'Montant des ventes',
                      data: (salesData.time_series || []).map(item => item.amount),
                      borderColor: 'rgb(34, 197, 94)',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      fill: true,
                      tension: 0.4
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `Ventes: ${formatCurrency(context.parsed.y)}`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => formatCurrency(value)
                        }
                      },
                      x: {
                        grid: {
                          display: false
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Orders Chart */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Commandes</h3>
              <div className="h-[300px] w-full">
                <Bar
                  data={{
                    labels: (salesData.time_series || []).map(item => {
                      const date = new Date(item.timestamp);
                      switch(selectedPeriod) {
                        case 'HOUR':
                          return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        case 'DAY':
                          return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
                        case 'MONTH':
                          return date.toLocaleDateString('fr-FR', { month: 'long' });
                        case 'YEAR':
                          return date.getFullYear().toString();
                        default:
                          return item.timestamp;
                      }
                    }),
                    datasets: [{
                      label: 'Nombre de commandes',
                      data: (salesData.time_series || []).map(item => item.order_count),
                      backgroundColor: 'rgb(59, 130, 246)',
                      borderRadius: 4
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `Commandes: ${context.parsed.y}`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1
                        }
                      },
                      x: {
                        grid: {
                          display: false
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="top-items">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Articles les Plus Vendus</h3>
            <div className="space-y-4">
              {(salesData.top_selling_items || []).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">{item.menu_item__name}</span>
                      <p className="text-sm text-gray-500">
                        {item.total_quantity} {item.total_quantity === 1 ? 'unité' : 'unités'} vendues
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-green-600 font-semibold block">{formatCurrency(item.total_sales)}</span>
                    <span className="text-xs text-gray-500">Revenu Total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default SalesAnalytics;
